import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { AuthDialog } from "../../components/auth/AuthDialog";
import { SignOutButton } from "../../components/auth/SignOutButton";
import { UsernameForm } from "./UsernameForm";
import { resolveAccountIdForAuthUserId } from "../../lib/auth/resolve-account";
import { listAccountAuthMethods } from "../../lib/auth/account-auth-methods";
import { SignInMethodsManager } from "./SignInMethodsManager";
import { AccountSecuritySection } from "./AccountSecuritySection";
import { AuthErrorRecoveryPanel } from "../../components/auth/AuthErrorRecoveryPanel";
import type { PostAuthIntent } from "../../lib/auth/auth-redirect";
import { readPendingAuthContextFromCookieValue, getPendingAuthContextCookieKey } from "../../lib/auth/auth-redirect";
import { LastGameFallback } from "./LastGameFallback";

type AccountPageProps = {
  searchParams?: Promise<{
    link_error?: string;
    auth_error?: string;
    next?: string;
    game_slug?: string;
    link_player_id?: string;
    expected_link?: string;
    auth_intent?: string;
    email?: string;
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const linkError = typeof params?.link_error === "string" ? params.link_error : null;
  const authError = typeof params?.auth_error === "string" ? params.auth_error : null;
  const showAuthRecovery =
    typeof authError === "string" &&
    /sign-?in link|complete sign-?in from that link|didn.?t work in this browser/i.test(authError);
  const authIntent: PostAuthIntent | undefined =
    params?.auth_intent === "sign_in" ||
    params?.auth_intent === "save_stats" ||
    params?.auth_intent === "account_link"
      ? params.auth_intent
      : undefined;
  const authRecoveryContext = {
    nextPath: typeof params?.next === "string" ? params.next : undefined,
    gameSlug: typeof params?.game_slug === "string" ? params.game_slug : undefined,
    linkPlayerId: typeof params?.link_player_id === "string" ? params.link_player_id : undefined,
    expectedLink: params?.expected_link === "1",
    intent: authIntent,
    email: typeof params?.email === "string" ? params.email : undefined,
  };
  const supabase = await createSupabaseServerClient();
  const cookieStore = await (await import("next/headers")).cookies();
  const pendingContextFromCookie = readPendingAuthContextFromCookieValue(
    cookieStore.get(getPendingAuthContextCookieKey())?.value,
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.info("[auth][me] server auth snapshot", {
    hasUser: Boolean(user?.id),
    userId: user?.id ?? null,
    hasPendingAuthContextCookie: Boolean(pendingContextFromCookie),
  });

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

          {showAuthRecovery && authError ? (
            <AuthErrorRecoveryPanel authError={authError} initialContext={authRecoveryContext} />
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

  const [statsQuery, recentGamesQuery, hostedGamesQuery, joinedGamesQuery] = await Promise.all([
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
    supabase
      .from("games")
      .select("id, title, slug, status")
      .eq("auth_user_id", user.id)
      .limit(8),
    supabase
      .from("players")
      .select("game_id, games:games(id, title, slug, status)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const statsErrorMessage = statsQuery.error?.message ?? null;
  const recentGamesErrorMessage = recentGamesQuery.error?.message ?? null;
  const hostedGamesErrorMessage = hostedGamesQuery.error?.message ?? null;
  const joinedGamesErrorMessage = joinedGamesQuery.error?.message ?? null;

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

  const hostedGames =
    (hostedGamesQuery.data as Array<{
      id: string;
      title?: string | null;
      slug?: string | null;
      status?: string | null;
    }> | null) ?? [];

  const joinedRows =
    (joinedGamesQuery.data as Array<{
      game_id: string;
      games?: { id?: string; title?: string | null; slug?: string | null; status?: string | null } | null;
    }> | null) ?? [];

  const joinedGames = joinedRows
    .map((row) => ({
      id: row.games?.id ?? row.game_id,
      title: row.games?.title ?? null,
      slug: row.games?.slug ?? null,
      status: row.games?.status ?? null,
    }))
    .filter((row) => Boolean(row.id));

  const mergedRecentOrActiveGames = [...hostedGames, ...joinedGames].reduce<
    Array<{ id: string; title?: string | null; slug?: string | null; status?: string | null }>
  >((accumulator, game) => {
    const identity = game.slug?.trim() || game.id;
    if (!identity) {
      return accumulator;
    }

    if (accumulator.some((existing) => (existing.slug?.trim() || existing.id) === identity)) {
      return accumulator;
    }

    accumulator.push(game);
    return accumulator;
  }, []);

  const contextGameSlug = authRecoveryContext.gameSlug?.trim() || pendingContextFromCookie?.gameSlug?.trim() || null;
  const hasPendingAuthContext = Boolean(pendingContextFromCookie || authRecoveryContext.gameSlug);
  const contextGameAlreadyInRecentActive =
    Boolean(contextGameSlug) &&
    mergedRecentOrActiveGames.some((game) => game.slug?.trim() === contextGameSlug);
  const showContinueToGameBanner =
    hasPendingAuthContext && Boolean(contextGameSlug) && !contextGameAlreadyInRecentActive;

  const recentOrActiveGamesTop = mergedRecentOrActiveGames.slice(0, 6);

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

        <AccountSecuritySection />

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

        {showAuthRecovery && authError ? (
          <AuthErrorRecoveryPanel authError={authError} initialContext={authRecoveryContext} />
        ) : null}

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent / Active games</h2>
          {showContinueToGameBanner && contextGameSlug ? (
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              <p className="text-xs font-semibold uppercase tracking-wide">Continue to your game</p>
              <Link href={`/g/${contextGameSlug}/play`} className="mt-1 inline-flex font-semibold underline">
                Open /g/{contextGameSlug}/play
              </Link>
            </div>
          ) : null}
          {(hostedGamesErrorMessage || joinedGamesErrorMessage) && (
            <p className="mt-2 text-sm text-slate-600">
              We couldn&apos;t load all game shortcuts right now. You can still use your recent results below.
            </p>
          )}

          {recentOrActiveGamesTop.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No active or recent hosted/joined games found yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOrActiveGamesTop.map((game) => {
                const gameLabel = game.title?.trim() || game.slug?.trim() || game.id;
                const gameSlug = game.slug?.trim();
                const statusLabel = game.status?.trim() || "recent";

                return (
                  <li key={game.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {gameSlug ? (
                      <Link href={`/g/${gameSlug}/play`} className="truncate pr-3 font-medium text-slate-800 underline">
                        {gameLabel}
                      </Link>
                    ) : (
                      <span className="truncate pr-3 font-medium text-slate-800">{gameLabel}</span>
                    )}
                    <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <LastGameFallback
            showWhenListEmpty={recentOrActiveGamesTop.length === 0}
            excludedSlug={contextGameSlug}
          />
        </section>

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
