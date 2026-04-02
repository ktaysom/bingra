import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGameShareDataBySlug } from "../../../../lib/share/game-public";
import { getPublicBaseUrl } from "../../../../lib/share/share";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

type ResultsPageProps = {
  params: {
    slug: string;
  };
};

type GameWinnerRow = {
  winner_player_id: string | null;
};

type WinnerRow = {
  display_name: string | null;
};

async function getWinnerNameForGame(gameId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data: gameRow } = await supabase
    .from("games")
    .select("winner_player_id")
    .eq("id", gameId)
    .maybeSingle<GameWinnerRow>();

  if (!gameRow?.winner_player_id) {
    return null;
  }

  const { data: winnerRow } = await supabase
    .from("players")
    .select("display_name")
    .eq("game_id", gameId)
    .eq("id", gameRow.winner_player_id)
    .maybeSingle<WinnerRow>();

  return winnerRow?.display_name?.trim() || null;
}

export async function generateMetadata(props: ResultsPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const baseUrl = getPublicBaseUrl();
  const metadataBase = new URL(baseUrl);
  const game = await getPublicGameShareDataBySlug(slug);

  if (!game) {
    return {
      metadataBase,
      title: "Bingra results",
      description: "Final results from a Bingra game.",
    };
  }

  const winnerName = (await getWinnerNameForGame(game.id)) ?? "Someone";
  const title = `${winnerName} won Bingra 🏆`;
  const description = `${game.teamAName} vs ${game.teamBName}`;
  const resultsUrl = `${baseUrl}/g/${encodeURIComponent(slug)}/results`;
  const ogImageUrl = `${baseUrl}/g/${encodeURIComponent(slug)}/results-card`;

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
          alt: `Bingra results: ${description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ResultsPage(props: ResultsPageProps) {
  const { slug } = await props.params;
  const game = await getPublicGameShareDataBySlug(slug);

  if (!game) {
    notFound();
  }

  const winnerName = (await getWinnerNameForGame(game.id)) ?? "Winner";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-8 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Results</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{winnerName} won Bingra 🏆</h1>
        <p className="mt-2 text-sm text-slate-600">
          {game.teamAName} vs {game.teamBName}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/g/${slug}/play`}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            View full results
          </Link>
          <Link
            href={`/g/${slug}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open game
          </Link>
        </div>
      </section>
    </main>
  );
}
