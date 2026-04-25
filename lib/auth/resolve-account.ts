import { createSupabaseAdminClient } from "../supabase/admin";

export type ResolvedAccount = {
  accountId: string;
  source: "account_auth_links" | "legacy_fallback";
};

export async function resolveAccountIdForAuthUserId(authUserId: string): Promise<ResolvedAccount> {
  const startedAt = Date.now();
  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase
      .from("account_auth_links")
      .select("account_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle<{ account_id: string }>();

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      const missingTable =
        message.includes("account_auth_links") &&
        (message.includes("does not exist") || message.includes("relation") || message.includes("schema"));

      if (!missingTable) {
        console.warn("[resolveAccountIdForAuthUserId] link lookup failed, using fallback", {
          authUserId,
          error: error.message,
        });
      }

      return {
        accountId: authUserId,
        source: "legacy_fallback",
      };
    }

    if (data?.account_id) {
      console.info("[auth][resolve-account][timing]", {
        authUserId,
        durationMs: Date.now() - startedAt,
        source: "account_auth_links",
      });
      return {
        accountId: data.account_id,
        source: "account_auth_links",
      };
    }
  } catch (error) {
    console.warn("[resolveAccountIdForAuthUserId] unexpected lookup failure, using fallback", {
      authUserId,
      error,
    });
  }

  console.info("[auth][resolve-account][timing]", {
    authUserId,
    durationMs: Date.now() - startedAt,
    source: "legacy_fallback",
  });
  return {
    accountId: authUserId,
    source: "legacy_fallback",
  };
}
