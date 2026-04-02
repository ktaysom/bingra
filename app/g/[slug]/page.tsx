import type { Metadata } from "next";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { JoinForm } from "./JoinForm";
import { joinGameAction } from "../../actions/join-game";
import { AuthEntryPoint } from "../../../components/auth/AuthEntryPoint";
import {
  getSportProfileDefinition,
  getSportProfileLabel,
  resolveSportProfileKey,
} from "../../../lib/bingra/sport-profiles";
import { getPublicGameShareDataBySlug } from "../../../lib/share/game-public";
import { buildGameUrl, getPublicBaseUrl } from "../../../lib/share/share";

type JoinPageProps = {
  params: {
    slug: string;
  };
};

type HostRecord = {
  display_name: string;
};

function getSportEmoji(sportProfile: string | null | undefined): string {
  const profileKey = resolveSportProfileKey(sportProfile);
  const sport = getSportProfileDefinition(profileKey).sport;

  if (sport === "soccer") {
    return "⚽";
  }

  return "🏀";
}

function getCardPreviewEvents(sportProfile: string | null | undefined): string[] {
  const profileKey = resolveSportProfileKey(sportProfile);
  const sport = getSportProfileDefinition(profileKey).sport;

  if (sport === "soccer") {
    return [
      "Goal in first half",
      "Penalty kick",
      "Yellow card",
      "Corner kick",
      "Halftime lead change",
      "Big save",
      "Late equalizer",
      "Free kick chance",
      "Final whistle upset",
    ];
  }

  return [
    "Opening 3-pointer",
    "Steal + fast break",
    "And-1 finish",
    "Charge drawn",
    "Buzzer beater",
    "Big block",
    "Team timeout run",
    "Clutch free throws",
    "Lead change late",
  ];
}

export async function generateMetadata(props: JoinPageProps): Promise<Metadata> {
  const { slug } = await props.params;

  const baseUrl = getPublicBaseUrl();
  const metadataBase = new URL(baseUrl);
  const game = await getPublicGameShareDataBySlug(slug);

  if (!game) {
    return {
      title: "Join game | Bingra",
      description: "Predict game events and race to Bingra.",
    };
  }

  const title = `${game.teamAName} vs ${game.teamBName} | Bingra`;
  const description = "Predict game events and race to Bingra.";
  const gameUrl = buildGameUrl(slug, baseUrl);
  const ogImageUrl = `${gameUrl}/opengraph-image`;

  const metadata: Metadata = {
    metadataBase,
    title,
    description,
    alternates: {
      canonical: gameUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: gameUrl,
      siteName: "Bingra",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Bingra: ${game.teamAName} vs ${game.teamBName}`,
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

  return metadata;
}

export default async function JoinGamePage(props: JoinPageProps) {
  const { slug } = await props.params;

  const supabase = createSupabaseAdminClient();
  const supabaseServer = await createSupabaseServerClient();

  const [{ data: authUserData }, game] = await Promise.all([
    supabaseServer.auth.getUser(),
    getPublicGameShareDataBySlug(slug),
  ]);

  const user = authUserData.user;

  const showError = !game;

  if (showError) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
        <div className="rounded-2xl bg-white/90 p-8 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500"></p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-900">We couldn&apos;t find that room</h1>
          <p className="mt-2 text-neutral-600">Double-check the link or ask the host to resend the invite.</p>
        </div>
      </main>
    );
  }

  const [{ data: host }, { count: joinedPlayersCount }] = await Promise.all([
    supabase
      .from("players")
      .select("display_name")
      .eq("game_id", game.id)
      .eq("role", "host")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<HostRecord>(),
    supabase.from("players").select("id", { head: true, count: "exact" }).eq("game_id", game.id),
  ]);

  const teamAName = game.teamAName;
  const teamBName = game.teamBName;
  const hostName = host?.display_name?.trim() || "Host";
  const sportProfileLabel = getSportProfileLabel(resolveSportProfileKey(game.sportProfile));
  const sportEmoji = getSportEmoji(game.sportProfile);
  const previewEvents = getCardPreviewEvents(game.sportProfile);
  const joinedPlayersLabel =
    typeof joinedPlayersCount === "number" && joinedPlayersCount > 0
      ? `${joinedPlayersCount} ${joinedPlayersCount === 1 ? "player" : "players"} already joined`
      : null;

  let initialDisplayName = "";

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
      .maybeSingle<{ username?: string | null; display_name?: string | null }>();

    initialDisplayName = profile?.username?.trim() || profile?.display_name?.trim() || "";
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white/90 p-8 shadow-md">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {sportEmoji} {sportProfileLabel}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            {teamAName} vs {teamBName}
          </h1>
          <p className="text-base font-medium text-slate-700">Play Bingra with friends</p>
          <div className="space-y-1 text-sm text-slate-500">
            <p>Hosted by {hostName}</p>
            {joinedPlayersLabel ? <p>{joinedPlayersLabel}</p> : null}
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Predict game moments and complete your card before everyone else.
          </p>
          {game.title ? <p className="text-xs text-slate-400">Game: {game.title}</p> : null}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-50 p-4 shadow-sm">
          <p className="mb-1 text-sm font-medium text-slate-700">Your Bingra card might look like this</p>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Bingra card preview</p>
          <div className="grid grid-cols-3 gap-2">
            {previewEvents.map((event, index) => {
              const isCompletedSample = index === 1 || index === 5;

              return (
                <div
                  key={`${event}-${index}`}
                  className={`relative flex min-h-16 items-center justify-center rounded-xl border px-2 py-3 text-center text-[11px] font-medium leading-tight shadow-sm ${
                    isCompletedSample
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {isCompletedSample ? (
                    <span className="absolute right-1.5 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                  {event}
                </div>
              );
            })}
          </div>
        </div>

        <JoinForm slug={slug} initialDisplayName={initialDisplayName} action={joinGameAction} />

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>Already have an account?</span>
          <AuthEntryPoint nextPath={`/g/${slug}`} subtle />
        </div>
      </section>
    </main>
  );
}