import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicGameShareDataBySlug } from "../../../../lib/share/game-public";
import { getPublicBaseUrl } from "../../../../lib/share/share";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { buildGameScores, type GameScoreEntry } from "../../../../lib/bingra/game-results";
import { normalizeCardCells, type CompletionMode, type RecordedEvent } from "../../../../lib/bingra/card-progress";
import { resolveSportProfileKey } from "../../../../lib/bingra/sport-profiles";

type ResultsPageProps = {
  params: {
    slug: string;
  };
};

type GameResultsRow = {
  id: string;
  winner_player_id: string | null;
  completion_mode: CompletionMode;
  sport_profile: string | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
  created_at: string | null;
};

type CardRow = {
  player_id: string;
  accepted_at: string | null;
  card_cells: Array<{
    event_key: string | null;
    team_key: string | null;
    order_index: number;
    point_value: number | null;
    threshold?: number | null;
  }>;
};

type ScoredEventRow = {
  event_key: string | null;
  team_key: string | null;
  created_at: string | null;
};

type CompletionRow = {
  player_id: string;
  created_at: string;
};

type PublicResultsData = {
  winnerName: string | null;
  leaderboard: GameScoreEntry[];
};

async function resolveMetadataOrigin(): Promise<string> {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";

  if (host && !host.toLowerCase().includes("localhost") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`;
  }

  return getPublicBaseUrl();
}

async function getPublicResultsDataByGameId(gameId: string): Promise<PublicResultsData> {
  const supabase = createSupabaseAdminClient();

  const [{ data: game }, { data: players }, { data: cards }, { data: scoredEvents }, { data: completions }] =
    await Promise.all([
      supabase
        .from("games")
        .select("id, winner_player_id, completion_mode, sport_profile")
        .eq("id", gameId)
        .maybeSingle<GameResultsRow>(),
      supabase
        .from("players")
        .select("id, display_name, created_at")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<PlayerRow[]>(),
      supabase
        .from("cards")
        .select("player_id, accepted_at, card_cells(event_key, team_key, order_index, point_value, threshold)")
        .eq("game_id", gameId)
        .returns<CardRow[]>(),
      supabase
        .from("scored_events")
        .select("event_key, team_key, created_at")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .returns<ScoredEventRow[]>(),
      supabase
        .from("game_completions")
        .select("player_id, created_at")
        .eq("game_id", gameId)
        .returns<CompletionRow[]>(),
    ]);

  if (!game) {
    return { winnerName: null, leaderboard: [] };
  }

  const recordedEvents: RecordedEvent[] = (scoredEvents ?? []).map((event) => ({
    event_key: event.event_key,
    team_key: event.team_key,
    created_at: event.created_at,
  }));

  const bingraPlayerIds = new Set((completions ?? []).map((completion) => completion.player_id));
  const bingraCompletedAtByPlayerId = new Map<string, string>();
  for (const completion of completions ?? []) {
    const existing = bingraCompletedAtByPlayerId.get(completion.player_id);
    if (!existing || completion.created_at < existing) {
      bingraCompletedAtByPlayerId.set(completion.player_id, completion.created_at);
    }
  }

  const leaderboard = buildGameScores({
    players: (players ?? []).map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
    })),
    cards: (cards ?? []).map((card) => ({
      player_id: card.player_id,
      accepted_at: card.accepted_at,
      card_cells: normalizeCardCells(
        (card.card_cells ?? []).map((cell) => ({
          event_key: cell.event_key,
          team_key: cell.team_key,
          order_index: cell.order_index,
          point_value: cell.point_value,
          threshold: cell.threshold,
        })),
      ),
    })),
    recordedEvents,
    completionMode: game.completion_mode,
    sportProfile: resolveSportProfileKey(game.sport_profile),
    bingraPlayerIds,
    bingraCompletedAtByPlayerId,
  });

  const winnerName = game.winner_player_id
    ? (players ?? []).find((player) => player.id === game.winner_player_id)?.display_name ?? null
    : leaderboard[0]?.player_name ?? null;

  return {
    winnerName,
    leaderboard,
  };
}

export async function generateMetadata(props: ResultsPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const baseUrl = await resolveMetadataOrigin();
  const metadataBase = new URL(baseUrl);
  const game = await getPublicGameShareDataBySlug(slug);

  if (!game) {
    return {
      metadataBase,
      title: "Bingra results",
      description: "Final results from a Bingra game.",
    };
  }

  const resultsData = await getPublicResultsDataByGameId(game.id);
  const winnerName = resultsData.winnerName ?? "Someone";
  const winnerEntry = resultsData.leaderboard.find((entry) => entry.player_name === winnerName) ?? resultsData.leaderboard[0] ?? null;
  const title = `${winnerName} won Bingra 🏆`;
  const description = `${game.teamAName} vs ${game.teamBName}`;
  const resultsUrl = `${baseUrl}/g/${encodeURIComponent(slug)}/results`;
  const ogImageUrl = new URL(`/g/${encodeURIComponent(slug)}/results-card`, baseUrl);
  ogImageUrl.searchParams.set("teamA", game.teamAName);
  ogImageUrl.searchParams.set("teamB", game.teamBName);
  ogImageUrl.searchParams.set("winner", winnerName);
  ogImageUrl.searchParams.set("score", String(winnerEntry?.final_score ?? "—"));
  ogImageUrl.searchParams.set("raw", String(winnerEntry?.raw_points ?? "—"));
  if (winnerEntry?.has_bingra) {
    ogImageUrl.searchParams.set("bingra", "1");
  }

  if (process.env.DEBUG_RESULTS_METADATA === "1") {
    console.info("[results-metadata]", {
      slug,
      resultsUrl,
      ogImageUrl: ogImageUrl.toString(),
      baseUrl,
    });
  }

  return {
    metadataBase,
    title,
    description,
    alternates: {
      canonical: resultsUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: resultsUrl,
      siteName: "Bingra",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `Bingra results: ${description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl.toString()],
    },
  };
}

export default async function ResultsPage(props: ResultsPageProps) {
  const { slug } = await props.params;
  const game = await getPublicGameShareDataBySlug(slug);

  if (!game) {
    notFound();
  }

  const resultsData = await getPublicResultsDataByGameId(game.id);
  const winnerName = resultsData.winnerName ?? "Winner";
  const winnerEntry = resultsData.leaderboard.find((entry) => entry.player_name === winnerName) ?? resultsData.leaderboard[0] ?? null;
  const topThree = resultsData.leaderboard.slice(0, 3);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-violet-50 p-8 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bingra Results</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{winnerName} won Bingra 🏆</h1>
        <p className="mt-2 text-sm text-slate-600">
          {game.teamAName} vs {game.teamBName}
        </p>

        {winnerEntry ? (
          <p className="mt-3 text-sm text-slate-700">
            Final score <span className="font-bold text-slate-900">{winnerEntry.final_score}</span> · Raw{" "}
            <span className="font-semibold text-slate-900">{winnerEntry.raw_points}</span>
            {winnerEntry.has_bingra ? " · Bingra x2" : ""}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Create Your Own Bingra
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go to Bingra Home
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final leaderboard</p>
        <ol className="mt-3 space-y-2">
          {topThree.length === 0 ? (
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Final standings are not available yet.
            </li>
          ) : (
            topThree.map((entry, index) => (
              <li
                key={`${entry.player_id}-${index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {entry.player_name}
                </p>
                <p className="text-xs text-slate-600">
                  {entry.final_score} final · {entry.raw_points} raw{entry.has_bingra ? " · Bingra x2" : ""}
                </p>
              </li>
            ))
          )}
        </ol>

        <Link
          href={`/g/${slug}/play`}
          className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          View full game details
        </Link>
      </section>
    </main>
  );
}
