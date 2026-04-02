import Link from "next/link";
import type { ReactNode } from "react";
import { BingraLogo } from "../components/BingraLogo";
import { AuthDialog } from "../components/auth/AuthDialog";
import { JoinGameInput } from "../components/home/JoinGameInput";
import { resolveAccountIdForAuthUserId } from "../lib/auth/resolve-account";
import { createSupabaseServerClient } from "../lib/supabase/server";

type HomeGameRow = {
  id: string;
  slug: string | null;
  status: "lobby" | "live" | "finished" | string;
  teamAName: string | null;
  teamBName: string | null;
  title: string | null;
  personalContext: string | null;
};

function HomeSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-bingra-dark sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-bingra-gray-medium">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function HomeExampleSection() {
  const exampleRows = [
    { label: "2+ Travel", progress: "1 / 2" },
    { label: "2+ Double Dribble", progress: "0 / 2" },
    { label: "6+ Made 3PT FG", progress: "4 / 6" },
    { label: "24+ Made Free Throw", progress: "12 / 24" },
    { label: "3+ Timeout", progress: "0 / 3" },
  ];

  return (
    <section className="rounded-2xl border border-bingra-gray-light bg-white p-5 sm:p-6">
      <HomeSectionHeader title="Example Game + Card" description="Static preview" />

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Example Live Game</p>
          <p className="mt-2 text-xl font-semibold">Lakers vs Celtics</p>
          <p className="mt-1 text-sm text-white/80">Pro Basketball</p>
        </div>

        <div className="rounded-xl border border-bingra-gray-light bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Example Bingra Card</p>
          <ul className="mt-3 space-y-2">
            {exampleRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-bingra-gray-light bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-bingra-dark">{row.label}</span>
                <span className="rounded-md bg-bingra-gray-light/70 px-2 py-1 text-xs font-semibold text-bingra-gray-medium">
                  {row.progress}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function getGameStatusMeta(status: string | null | undefined) {
  if (status === "live") {
    return { statusLabel: "Live", supportingText: "Game in progress", actionLabel: "Open Game" };
  }

  if (status === "lobby") {
    return { statusLabel: "Waiting", supportingText: "Waiting to start", actionLabel: "Open Game" };
  }

  return { statusLabel: "Completed", supportingText: "Game finished", actionLabel: "View Results" };
}

function getResumeContextLine(status: string | null | undefined): string {
  if (status === "live") return "Game in progress";
  if (status === "lobby") return "Waiting for host";
  return "Recently finished";
}

function getGameDisplayLabel(game: HomeGameRow): string {
  const teamA = game.teamAName?.trim();
  const teamB = game.teamBName?.trim();
  if (teamA && teamB) {
    return `${teamA} vs ${teamB}`;
  }

  return game.title?.trim() || game.slug?.trim() || game.id;
}

function normalizeGameStatus(status: string | null | undefined): "lobby" | "live" | "finished" | string {
  return status || "finished";
}

function dedupeGames(games: HomeGameRow[]): HomeGameRow[] {
  return games.reduce<HomeGameRow[]>((accumulator, game) => {
    const identity = game.slug?.trim() || game.id;
    if (!identity) return accumulator;
    if (accumulator.some((existing) => (existing.slug?.trim() || existing.id) === identity)) return accumulator;
    accumulator.push(game);
    return accumulator;
  }, []);
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeGames: HomeGameRow[] = [];
  let recentCompletedGames: HomeGameRow[] = [];
  let gamesPlayedLabel = "—";
  let winsLabel = "—";
  let bingrasLabel = "—";
  let winRateLabel = "—";
  let resumeLastGame: HomeGameRow | null = null;
  const joinSectionId = "join-game";
  const continueSectionId = "continue-playing";

  if (user?.id) {
    const resolvedAccount = await resolveAccountIdForAuthUserId(user.id);
    const profileId = resolvedAccount.accountId;
    let latestLiveGame: HomeGameRow | null = null;
    let latestLobbyGame: HomeGameRow | null = null;
    let mostRecentCompletedGame: HomeGameRow | null = null;

    const [activeGamesQuery, completedGamesQuery, gamesPlayedCountQuery, winsCountQuery, bingrasCountQuery] =
      await Promise.all([
        supabase
          .from("players")
          .select("game_id, games:games!players_game_id_fkey(id, slug, status, title, team_a_name, team_b_name)")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(24),
        supabase
          .from("profile_game_results")
          .select("game_id, rank, bingra_completed, finished_at, games:games(id, slug, status, title, team_a_name, team_b_name)")
          .eq("profile_id", profileId)
          .order("finished_at", { ascending: false })
          .limit(12),
        supabase.from("profile_game_results").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
        supabase
          .from("profile_game_results")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .eq("rank", 1),
        supabase
          .from("profile_game_results")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .eq("bingra_completed", true),
      ]);

    if (activeGamesQuery.error) {
      console.warn("[home] failed to load active games", activeGamesQuery.error.message);
    } else {
      const rows =
        (activeGamesQuery.data as Array<{
          game_id: string;
          games?: {
            id?: string;
            slug?: string | null;
            status?: string | null;
            title?: string | null;
            team_a_name?: string | null;
            team_b_name?: string | null;
          } | null;
        }> | null) ?? [];

      const allActiveCandidates = dedupeGames(
        rows
          .map((row) => {
            const gameId = row.games?.id ?? row.game_id;
            if (!gameId) return null;

            return {
              id: gameId,
              slug: row.games?.slug ?? null,
              status: normalizeGameStatus(row.games?.status),
              teamAName: row.games?.team_a_name ?? null,
              teamBName: row.games?.team_b_name ?? null,
              title: row.games?.title ?? null,
              personalContext: "Your card is in progress",
            } satisfies HomeGameRow;
          })
          .filter((row): row is HomeGameRow => Boolean(row))
          .filter((row) => row.status === "live" || row.status === "lobby"),
      );

      latestLiveGame = allActiveCandidates.find((row) => row.status === "live") ?? null;
      latestLobbyGame = allActiveCandidates.find((row) => row.status === "lobby") ?? null;
      activeGames = allActiveCandidates.slice(0, 3);
    }

    if (completedGamesQuery.error) {
      console.warn("[home] failed to load completed games", completedGamesQuery.error.message);
    } else {
      const rows =
        (completedGamesQuery.data as Array<{
          game_id: string;
          rank?: number | null;
          bingra_completed?: boolean | null;
          games?: {
            id?: string;
            slug?: string | null;
            title?: string | null;
            team_a_name?: string | null;
            team_b_name?: string | null;
          } | null;
        }> | null) ?? [];

      const mapped = rows
        .map((row) => {
          const gameId = row.games?.id ?? row.game_id;
          if (!gameId) return null;

          return {
            id: gameId,
            slug: row.games?.slug ?? null,
            status: "finished",
            teamAName: row.games?.team_a_name ?? null,
            teamBName: row.games?.team_b_name ?? null,
            title: row.games?.title ?? null,
            personalContext: row.bingra_completed ? "You completed Bingra" : row.rank === 1 ? "You won this game" : null,
          } satisfies HomeGameRow;
        })
        .filter((row): row is HomeGameRow => Boolean(row));

      const activeIdentities = new Set(activeGames.map((game) => game.slug?.trim() || game.id));
      const completedCandidates = dedupeGames(mapped).filter(
        (game) => !activeIdentities.has(game.slug?.trim() || game.id),
      );

      mostRecentCompletedGame = completedCandidates[0] ?? null;
      recentCompletedGames = completedCandidates.slice(0, 5);
    }

    resumeLastGame = latestLiveGame ?? latestLobbyGame ?? mostRecentCompletedGame;

    if (gamesPlayedCountQuery.error || winsCountQuery.error || bingrasCountQuery.error) {
      console.warn("[home] failed to load one or more career stat counts", {
        gamesPlayed: gamesPlayedCountQuery.error?.message,
        wins: winsCountQuery.error?.message,
        bingras: bingrasCountQuery.error?.message,
      });
    }

    if (
      typeof gamesPlayedCountQuery.count === "number" &&
      typeof winsCountQuery.count === "number" &&
      typeof bingrasCountQuery.count === "number"
    ) {
      gamesPlayedLabel = String(gamesPlayedCountQuery.count);
      winsLabel = String(winsCountQuery.count);
      bingrasLabel = String(bingrasCountQuery.count);
      winRateLabel =
        gamesPlayedCountQuery.count > 0
          ? `${Math.round((winsCountQuery.count / Math.max(1, gamesPlayedCountQuery.count)) * 100)}%`
          : "—";
    }
  }

  const hasAnyGames = activeGames.length > 0 || recentCompletedGames.length > 0;
  const heroSecondaryCtaHref = user ? (hasAnyGames ? `#${continueSectionId}` : `#${joinSectionId}`) : `#${joinSectionId}`;
  const heroSecondaryCtaLabel = user ? (hasAnyGames ? "Continue Playing" : "Join a Game") : "Join a Game";

  return (
    <main className="min-h-screen bg-bingra-app-bg">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6 sm:py-8">
      <div className="space-y-7">
        <header className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <Link href="/" aria-label="Bingra home">
            <BingraLogo />
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/me" className="inline-flex h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-semibold text-white">
                Profile
              </Link>
            ) : (
              <AuthDialog label="Sign In" nextPath="/" />
            )}
          </div>
        </header>

        <section className="px-1 py-2 sm:px-2">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#6b6159]">🏀 Basketball</span>
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#6b6159]">⚽ Soccer</span>
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.02em] text-[#2c2622] sm:text-5xl">Turn any game into Bingra.</h1>
          <p className="mt-3 max-w-2xl text-base text-[#6b6159]">
            Create a private game, build your card, and invite friends by link.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/create" className="btn-primary h-12 rounded-2xl px-7 text-base">
              Create Game
            </Link>
            <a href={heroSecondaryCtaHref} className="inline-flex h-12 items-center rounded-2xl border border-[#c5b8ab] bg-white px-5 text-sm font-semibold text-[#2f2925]">
              {heroSecondaryCtaLabel}
            </a>
          </div>
        </section>

        {user && resumeLastGame?.slug ? (
          <section className="rounded-2xl border-2 border-bingra-dark/20 bg-[#f8fbff] p-6">
            <HomeSectionHeader title="Continue Your Game" description="Pick up right where you left off." />
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-bingra-dark/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-bingra-dark">{getGameDisplayLabel(resumeLastGame)}</p>
                <p className="mt-1 text-sm text-bingra-gray-medium">{getResumeContextLine(resumeLastGame.status)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-bingra-gray-light bg-bingra-gray-light/60 px-2.5 py-1 text-xs font-semibold text-bingra-gray-medium">
                  {getGameStatusMeta(resumeLastGame.status).statusLabel}
                </span>
                <Link href={`/g/${resumeLastGame.slug}/play`} className="inline-flex h-11 items-center rounded-lg bg-bingra-dark px-6 text-sm font-semibold text-white">
                  Resume Game
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {user ? (
          <section id={continueSectionId} className="rounded-2xl border border-bingra-gray-light bg-white p-6">
            <HomeSectionHeader
              title="Continue Playing"
              description="Active games first, then your recent finished games."
              action={activeGames.length > 0 ? <Link href="/create" className="text-sm font-semibold text-bingra-dark underline">Create another game</Link> : undefined}
            />

            {activeGames.length === 0 && recentCompletedGames.length === 0 ? (
              <div id={joinSectionId} className="mt-4 rounded-xl border border-dashed border-bingra-gray-light bg-slate-50 p-5">
                <p className="text-bingra-gray-medium">You haven’t joined any games yet. Create one or jump in with an invite link.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/create" className="inline-flex items-center rounded-lg bg-bingra-dark px-4 py-2 text-sm font-semibold text-white">
                    Create Your First Game
                  </Link>
                </div>
                <div className="mt-4">
                  <JoinGameInput />
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {activeGames.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Active + waiting</p>
                    <ul className="mt-2 space-y-2">
                      {activeGames.map((game) => {
                        const statusMeta = getGameStatusMeta(game.status);
                        const slug = game.slug?.trim();

                        return (
                          <li key={`active-${game.id}`} className="flex flex-col gap-3 rounded-xl border border-bingra-gray-light bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-bingra-dark">{getGameDisplayLabel(game)}</p>
                              <p className="text-sm text-bingra-gray-medium">{statusMeta.supportingText}</p>
                              {game.personalContext ? <p className="text-sm text-bingra-gray-medium">{game.personalContext}</p> : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-full border border-bingra-gray-light bg-bingra-gray-light/60 px-2.5 py-1 text-xs font-semibold text-bingra-gray-medium">
                                {statusMeta.statusLabel}
                              </span>
                              {slug ? <Link href={`/g/${slug}/play`} className="inline-flex items-center rounded-lg bg-bingra-dark px-4 py-2 text-sm font-semibold text-white">{statusMeta.actionLabel}</Link> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {recentCompletedGames.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Recent results</p>
                    <ul className="mt-2 space-y-2">
                      {recentCompletedGames.map((game) => {
                        const statusMeta = getGameStatusMeta("finished");
                        const slug = game.slug?.trim();

                        return (
                          <li key={`completed-${game.id}`} className="flex flex-col gap-3 rounded-xl border border-bingra-gray-light/70 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-bingra-dark">{getGameDisplayLabel(game)}</p>
                              <p className="text-sm text-bingra-gray-medium">{statusMeta.supportingText}</p>
                              {game.personalContext ? <p className="text-sm text-bingra-gray-medium">{game.personalContext}</p> : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-full border border-bingra-gray-light bg-bingra-gray-light/60 px-2.5 py-1 text-xs font-semibold text-bingra-gray-medium">
                                {statusMeta.statusLabel}
                              </span>
                              {slug ? <Link href={`/g/${slug}/play`} className="inline-flex items-center rounded-lg border border-bingra-gray-light px-4 py-2 text-sm font-semibold text-bingra-dark">{statusMeta.actionLabel}</Link> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <HomeExampleSection />

        {!user ? (
          <section id={joinSectionId} className="rounded-2xl border border-bingra-gray-light bg-white p-6">
            <HomeSectionHeader title="Join with a Link or Code" description="Paste an invite link or enter a game code to jump in." />
            <div className="mt-4">
              <JoinGameInput />
            </div>
          </section>
        ) : null}

        {user ? (
          <section className="rounded-2xl border border-bingra-gray-light/80 bg-slate-50 p-5">
            <HomeSectionHeader title="Your Career Stats" description="Completed-game snapshot" />
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-bingra-gray-light bg-white p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Games Played</dt><dd className="mt-1 text-xl font-bold text-bingra-dark">{gamesPlayedLabel}</dd></div>
              <div className="rounded-xl border border-bingra-gray-light bg-white p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Wins</dt><dd className="mt-1 text-xl font-bold text-bingra-dark">{winsLabel}</dd></div>
              <div className="rounded-xl border border-bingra-gray-light bg-white p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Bingras</dt><dd className="mt-1 text-xl font-bold text-bingra-dark">{bingrasLabel}</dd></div>
              <div className="rounded-xl border border-bingra-gray-light bg-white p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Win Rate</dt><dd className="mt-1 text-xl font-bold text-bingra-dark">{winRateLabel}</dd></div>
            </dl>
          </section>
        ) : null}

        {user ? (
          <section className="rounded-2xl border border-bingra-gray-light/80 bg-slate-50 p-5">
            <HomeSectionHeader title="Rivalries" description="Head-to-head history against players you've faced the most." />
            {/* TODO: Implement rivalries once a reliable, RLS-safe head-to-head source is available for opponent results. */}
            <p className="mt-3 text-sm text-bingra-gray-medium">You haven’t built any rivalries yet.</p>
          </section>
        ) : null}
      </div>
      </div>
    </main>
  );
}
