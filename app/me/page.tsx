import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { AuthDialog } from "../../components/auth/AuthDialog";
import { SignOutButton } from "../../components/auth/SignOutButton";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
        <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">You&apos;re playing as a guest</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to attach games to your account and unlock upcoming career stats.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <AuthDialog label="Continue with email" nextPath="/me" emphasis="prominent" />
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const profileData = profile as { id?: string; display_name?: string | null } | null;
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

  const identityLabel =
    profileData?.display_name?.trim() || metadataName?.trim() || user.email || user.phone || "Signed-in user";

  const profileId = profileData?.id ?? user.id;

  const { data: statsRow } = await supabase
    .from("profile_stats")
    .select(
      "games_played, games_won, bingras_completed, avg_score, current_win_streak",
    )
    .eq("profile_id", profileId)
    .maybeSingle();

  const { data: recentGamesRows } = await supabase
    .from("profile_game_results")
    .select("game_id, rank, final_score, finished_at, games:games(title, slug)")
    .eq("profile_id", profileId)
    .order("finished_at", { ascending: false })
    .limit(5);

  const stats = (statsRow as {
    games_played?: number;
    games_won?: number;
    bingras_completed?: number;
    avg_score?: number | string | null;
    current_win_streak?: number;
  } | null) ?? {
    games_played: 0,
    games_won: 0,
    bingras_completed: 0,
    avg_score: null,
    current_win_streak: 0,
  };

  const recentGames =
    (recentGamesRows as Array<{
      game_id: string;
      rank: number;
      final_score: number;
      finished_at: string;
      games?: { title?: string | null; slug?: string | null } | null;
    }> | null) ?? [];

  const averageScoreLabel =
    stats.avg_score == null || Number.isNaN(Number(stats.avg_score))
      ? "—"
      : Number(stats.avg_score).toFixed(1);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{identityLabel}</h1>
        <p className="mt-2 text-sm text-slate-600">Your Bingra career snapshot.</p>

        <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Games played</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{stats.games_played ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wins</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{stats.games_won ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bingras</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{stats.bingras_completed ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average score</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{averageScoreLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current streak</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{stats.current_win_streak ?? 0}</dd>
          </div>
        </dl>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent games</h2>
          {recentGames.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No finished games tracked yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentGames.map((row) => {
                const gameLabel = row.games?.title?.trim() || row.games?.slug?.trim() || row.game_id;
                return (
                  <li
                    key={`${row.game_id}-${row.finished_at}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-3 font-medium text-slate-800">{gameLabel}</span>
                    <span className="whitespace-nowrap text-slate-600">
                      Rank #{row.rank} · Score {row.final_score}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auth user id</dt>
            <dd className="mt-1 break-all text-slate-800">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile id</dt>
            <dd className="mt-1 break-all text-slate-800">{profileData?.id ?? user.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 break-all text-slate-800">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
            <dd className="mt-1 break-all text-slate-800">{user.phone ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <SignOutButton redirectTo="/" />
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to game
          </Link>
        </div>
      </section>
    </main>
  );
}
