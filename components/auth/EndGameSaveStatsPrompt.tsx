"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthDialog } from "./AuthDialog";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type EndGameSaveStatsPromptProps = {
  gameId: string;
  slug: string;
  playerId: string;
  isFinished: boolean;
};

type CareerStatsSnapshot = {
  gamesPlayed: number;
  wins: number;
  bingras: number;
  bestFinish: number | null;
  bestScore: number | null;
  milestones: string[];
};

type ProfileGameResultRow = {
  game_id: string;
  rank: number;
  bingra_completed: boolean;
  final_score: number;
};

export function EndGameSaveStatsPrompt({
  gameId,
  slug,
  playerId,
  isFinished,
}: EndGameSaveStatsPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<"hidden" | "guest" | "saved">("hidden");
  const [isLoading, setIsLoading] = useState(true);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStatsSnapshot | null>(null);
  const [isCareerLoading, setIsCareerLoading] = useState(false);
  const dismissedRef = useRef(dismissed);

  useEffect(() => {
    dismissedRef.current = dismissed;
  }, [dismissed]);

  useEffect(() => {
    let mounted = true;

    if (!isFinished || !gameId || !playerId) {
      setIsLoading(false);
      setMode("hidden");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const countWins = (rows: ProfileGameResultRow[]) => rows.filter((row) => row.rank === 1).length;
    const countBingras = (rows: ProfileGameResultRow[]) =>
      rows.filter((row) => row.bingra_completed).length;

    const buildMilestones = (beforeRows: ProfileGameResultRow[], afterRows: ProfileGameResultRow[]) => {
      const beforeGamesPlayed = beforeRows.length;
      const afterGamesPlayed = afterRows.length;
      const beforeWins = countWins(beforeRows);
      const afterWins = countWins(afterRows);
      const beforeBingras = countBingras(beforeRows);
      const afterBingras = countBingras(afterRows);

      const milestones: string[] = [];

      if (beforeGamesPlayed < 1 && afterGamesPlayed >= 1) {
        milestones.push("First game played");
      }

      if (beforeWins < 1 && afterWins >= 1) {
        milestones.push("First win");
      }

      if (beforeBingras < 1 && afterBingras >= 1) {
        milestones.push("First Bingra");
      }

      for (const threshold of [5, 10, 25]) {
        if (beforeGamesPlayed < threshold && afterGamesPlayed >= threshold) {
          milestones.push(`${threshold} games played`);
        }
      }

      return milestones;
    };

    const hydrateCareerStats = async (userId: string) => {
      setIsCareerLoading(true);

      try {
        const profileResult = await supabase
          .from("profiles")
          .select("id")
          .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
          .maybeSingle();

        const profile = profileResult.data as { id: string } | null;

        const profileId = profile?.id ?? userId;

        const [statsResult, gameResultsResult] = await Promise.all([
          supabase
            .from("profile_stats")
            .select("games_played, games_won, bingras_completed, best_finish_position")
            .eq("profile_id", profileId)
            .maybeSingle(),
          supabase
            .from("profile_game_results")
            .select("game_id, rank, bingra_completed, final_score")
            .eq("profile_id", profileId)
            .order("finished_at", { ascending: true }),
        ]);

        const statsData = statsResult.data as {
          games_played: number;
          games_won: number;
          bingras_completed: number;
          best_finish_position: number | null;
        } | null;
        const gameRows = (gameResultsResult.data as ProfileGameResultRow[] | null) ?? [];

        if (!mounted) {
          return;
        }

        if (statsResult.error || gameResultsResult.error) {
          setCareerStats(null);
          return;
        }

        const currentGameIncluded = gameRows.some((row) => row.game_id === gameId);

        if (!currentGameIncluded) {
          setCareerStats(null);
          return;
        }

        const beforeRows = gameRows.filter((row) => row.game_id !== gameId);
        const bestScore = gameRows.reduce<number | null>((best, row) => {
          if (best == null) {
            return row.final_score;
          }

          return Math.max(best, row.final_score);
        }, null);

        setCareerStats({
          gamesPlayed: statsData?.games_played ?? gameRows.length,
          wins: statsData?.games_won ?? countWins(gameRows),
          bingras: statsData?.bingras_completed ?? countBingras(gameRows),
          bestFinish: statsData?.best_finish_position ?? null,
          bestScore,
          milestones: buildMilestones(beforeRows, gameRows),
        });
      } finally {
        if (mounted) {
          setIsCareerLoading(false);
        }
      }
    };

    const resolveAccountLabel = async (user: {
      id?: string;
      email?: string | null;
      phone?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      let profileDisplayName = "";

      if (user.id) {
        const { data } = await supabase
          .from("profiles")
          .select("username, display_name")
          .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
          .maybeSingle();

        const profile = data as { username?: string | null; display_name?: string | null } | null;
        const profileUsername = profile?.username?.trim() ?? "";
        profileDisplayName = profile?.display_name?.trim() ?? "";

        if (profileUsername) {
          return profileUsername;
        }
      }

      const metadataDisplayName =
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name.trim()
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name.trim()
              : "";

      return profileDisplayName || metadataDisplayName || user.email || user.phone || null;
    };

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (data.user?.id) {
        const label = await resolveAccountLabel(data.user);
        if (!mounted) {
          return;
        }

        if (dismissedRef.current) {
          setMode("hidden");
        } else {
          setAccountLabel(label);
          setMode("saved");
          void hydrateCareerStats(data.user.id);
        }

        setIsLoading(false);
        return;
      }

      setMode(dismissedRef.current ? "hidden" : "guest");

      setIsLoading(false);
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!mounted) {
          return;
        }

        if (session?.user?.id) {
          const label = await resolveAccountLabel(session.user);
          if (!mounted) {
            return;
          }

          if (dismissedRef.current) {
            setMode("hidden");
          } else {
            setAccountLabel(label);
            setMode("saved");
            void hydrateCareerStats(session.user.id);
          }
        } else {
          setMode(dismissedRef.current ? "hidden" : "guest");
          setCareerStats(null);
          setIsCareerLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [gameId, isFinished, playerId]);

  if (!isFinished || isLoading || mode === "hidden") {
    return null;
  }

  const isSaved = mode === "saved";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Game complete</p>
        {isSaved ? (
          <>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Stats saved</h3>
            <p className="mt-2 text-sm text-slate-600">This game is now attached to your account.</p>
            {accountLabel ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">Signed in as {accountLabel}</p>
            ) : null}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Career snapshot</p>
              {isCareerLoading ? (
                <p className="mt-2 text-xs text-slate-600">Updating your career with this game...</p>
              ) : careerStats ? (
                <>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">Games</dt>
                      <dd className="font-semibold text-slate-900">{careerStats.gamesPlayed}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Wins</dt>
                      <dd className="font-semibold text-slate-900">{careerStats.wins}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Bingras</dt>
                      <dd className="font-semibold text-slate-900">{careerStats.bingras}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Best finish</dt>
                      <dd className="font-semibold text-slate-900">
                        {careerStats.bestFinish != null ? `#${careerStats.bestFinish}` : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">Best score</dt>
                      <dd className="font-semibold text-slate-900">
                        {careerStats.bestScore != null ? careerStats.bestScore : "—"}
                      </dd>
                    </div>
                  </dl>

                  {careerStats.milestones.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-violet-700">New milestone{careerStats.milestones.length > 1 ? "s" : ""}!</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {careerStats.milestones.map((milestone) => (
                          <span
                            key={milestone}
                            className="inline-flex rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                          >
                            🎉 {milestone}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-600">Career stats are syncing. Check your account page in a moment.</p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                href="/create"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Create your own Bingra
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setMode("hidden");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Save your stats</h3>
            <p className="mt-2 text-sm text-slate-600">
              Keep your result, unlock career tracking, and build your Bingra history.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <AuthDialog
                label="Sign in"
                nextPath={`/g/${slug}/play`}
                linkPlayerId={playerId}
                emphasis="prominent"
              />
              <Link
                href="/create"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Create your own Bingra
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setMode("hidden");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Maybe later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}