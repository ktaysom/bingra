import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { AuthDialog } from "../../components/auth/AuthDialog";
import { SignOutButton } from "../../components/auth/SignOutButton";
import { UsernameForm } from "./UsernameForm";
import { resolveAccountIdForAuthUserId } from "../../lib/auth/resolve-account";
import { listAccountAuthMethods } from "../../lib/auth/account-auth-methods";
import { SignInMethodsManager } from "./SignInMethodsManager";

type AccountPageProps = {
  searchParams?: Promise<{
    link_error?: string;
    auth_error?: string;
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const linkError = typeof params?.link_error === "string" ? params.link_error : null;
  const authError = typeof params?.auth_error === "string" ? params.auth_error : null;
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
          {authError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {authError}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <AuthDialog label="Sign in" nextPath="/me" emphasis="prominent" />
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

  const resolvedAccount = await resolveAccountIdForAuthUserId(user.id);
  const accountId = resolvedAccount.accountId;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .or(`id.eq.${accountId},id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const profileData = profile as { id?: string; username?: string | null; display_name?: string | null } | null;
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

  const identityLabel =
    profileData?.username?.trim() ||
    profileData?.display_name?.trim() ||
    metadataName?.trim() ||
    user.email ||
    user.phone ||
    "Signed-in user";

  const usernameLabel = profileData?.username?.trim() || "";
  let signInMethods = await listAccountAuthMethods(accountId).catch(() => []);
  if (!signInMethods.length) {
    signInMethods = [
      {
        auth_user_id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        linked_at: null,
        is_primary: true,
      },
    ].filter((method) => Boolean(method.email || method.phone));
  }

  const profileId = accountId;

  const [statsQuery, recentGamesQuery] = await Promise.all([
    supabase
      .from("profile_stats")
      .select(
        "games_played, games_won, bingras_completed, avg_score, current_win_streak",
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("profile_game_results")
      .select("game_id, rank, final_score, finished_at, games:games(title, slug)")
      .eq("profile_id", profileId)
      .order("finished_at", { ascending: false })
      .limit(5),
  ]);

  const statsErrorMessage = statsQuery.error?.message ?? null;
  const recentGamesErrorMessage = recentGamesQuery.error?.message ?? null;

  const stats = (statsQuery.data as {
    games_played?: number;
    games_won?: number;
    bingras_completed?: number;
    avg_score?: number | string | null;
    current_win_streak?: number;
  } | null) ?? null;

  const recentGames =
    (recentGamesQuery.data as Array<{
      game_id: string;
      rank: number;
      final_score: number;
      finished_at: string;
      games?: { title?: string | null; slug?: string | null } | null;
    }> | null) ?? [];

  const hasStatsRow = Boolean(stats);
  const hasRecentGames = recentGames.length > 0;
  const hasUnrebuiltAggregateGap = !hasStatsRow && hasRecentGames;

  const gamesPlayedLabel = hasStatsRow
    ? String(stats?.games_played ?? 0)
    : hasRecentGames
      ? "—"
      : "0";

  const winsLabel = hasStatsRow
    ? String(stats?.games_won ?? 0)
    : hasRecentGames
      ? "—"
      : "0";

  const bingrasLabel = hasStatsRow
    ? String(stats?.bingras_completed ?? 0)
    : hasRecentGames
      ? "—"
      : "0";

  const streakLabel = hasStatsRow
    ? String(stats?.current_win_streak ?? 0)
    : hasRecentGames
      ? "—"
      : "0";

  const averageScoreLabel =
    stats?.avg_score == null || Number.isNaN(Number(stats.avg_score))
      ? "—"
      : Number(stats.avg_score).toFixed(1);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{identityLabel}</h1>
        <p className="mt-2 text-sm text-slate-600">Your Bingra career snapshot.</p>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Public username</h2>
          <p className="mt-1 text-xs text-slate-600">
            This is your public identity when you join games.
          </p>
          <UsernameForm initialUsername={usernameLabel} />
        </section>

        <SignInMethodsManager methods={signInMethods} />

        {linkError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {linkError}
          </p>
        ) : null}

        {authError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {authError}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Games played</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{gamesPlayedLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wins</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{winsLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bingras</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{bingrasLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average score</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{averageScoreLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current streak</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{streakLabel}</dd>
          </div>
        </dl>

        {(statsErrorMessage || hasUnrebuiltAggregateGap || (!hasStatsRow && !hasRecentGames)) && (
          <p className="mt-3 text-xs text-slate-600">
            {statsErrorMessage
              ? `Career snapshot is temporarily unavailable (${statsErrorMessage}).`
              : hasUnrebuiltAggregateGap
                ? "Finished games were found, but aggregate career stats are not generated yet. Run the repair/rebuild utility to populate profile_stats."
                : "No finished games yet. Complete a game to start your career snapshot."}
          </p>
        )}

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent games</h2>
          {recentGamesErrorMessage ? (
            <p className="mt-2 text-sm text-slate-600">
              Unable to load recent games right now ({recentGamesErrorMessage}).
            </p>
          ) : recentGames.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              {hasStatsRow && (stats?.games_played ?? 0) > 0
                ? "No recent result rows are available yet. If you repaired links recently, run the rebuild utility to regenerate profile_game_results."
                : "No finished games tracked yet."}
            </p>
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
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account id</dt>
            <dd className="mt-1 break-all text-slate-800">{accountId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</dt>
            <dd className="mt-1 break-all text-slate-800">{profileData?.username ?? "—"}</dd>
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
