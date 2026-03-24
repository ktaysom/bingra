import { createSupabaseAdminClient } from "../supabase/admin";
import { listAccountAuthMethods } from "../auth/account-auth-methods";

export async function inspectAccountById(accountId: string): Promise<{
  account: {
    id: string;
    username?: string | null;
    is_active?: boolean | null;
    merged_into_account_id?: string | null;
    merged_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  linkedAuthMethods: Awaited<ReturnType<typeof listAccountAuthMethods>>;
  counts: {
    players: number;
    recentProfileGameResults: number;
    hasProfileStatsRow: boolean;
  };
}> {
  const supabase = createSupabaseAdminClient();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, username, is_active, merged_into_account_id, merged_at, created_at, updated_at")
    .eq("id", accountId)
    .maybeSingle<{
      id: string;
      username?: string | null;
      is_active?: boolean | null;
      merged_into_account_id?: string | null;
      merged_at?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    }>();

  if (accountError) {
    throw accountError;
  }

  if (!account?.id) {
    return {
      account: null,
      linkedAuthMethods: [],
      counts: {
        players: 0,
        recentProfileGameResults: 0,
        hasProfileStatsRow: false,
      },
    };
  }

  const [authMethods, playersQuery, gameResultsQuery, statsQuery] = await Promise.all([
    listAccountAuthMethods(account.id),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("profile_id", account.id),
    supabase
      .from("profile_game_results")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", account.id)
      .gte("finished_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()),
    supabase.from("profile_stats").select("profile_id").eq("profile_id", account.id).maybeSingle(),
  ]);

  if (playersQuery.error) throw playersQuery.error;
  if (gameResultsQuery.error) throw gameResultsQuery.error;
  if (statsQuery.error) throw statsQuery.error;

  return {
    account,
    linkedAuthMethods: authMethods,
    counts: {
      players: playersQuery.count ?? 0,
      recentProfileGameResults: gameResultsQuery.count ?? 0,
      hasProfileStatsRow: Boolean((statsQuery.data as { profile_id?: string } | null)?.profile_id),
    },
  };
}
