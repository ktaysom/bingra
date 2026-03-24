import { createSupabaseAdminClient } from "../supabase/admin";
import { resolveAccountIdForAuthUserId } from "./resolve-account";

export type ProfileRecord = {
  id: string;
  username?: string;
  display_name?: string | null;
  // Canonical app identity: profiles.id === auth.users.id
  // Keep all stats/ownership keyed to this stable UUID, not email/phone identifiers.
  auth_user_id?: string;
};

export function normalizeUsernameInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "");
}

export function buildFallbackUsernameFromId(id: string): string {
  return `player_${id.replace(/-/g, "").toLowerCase()}`;
}

async function syncAccountCompatibilityFromProfile(profile: ProfileRecord, authUserId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const username = normalizeUsernameInput(profile.username ?? "") || buildFallbackUsernameFromId(profile.id);

  try {
    const { error: accountError } = await supabase
      .from("accounts")
      .upsert(
        {
          id: profile.id,
          username,
        },
        { onConflict: "id" },
      );

    if (accountError) {
      throw accountError;
    }

    const { data: accountRow, error: accountLookupError } = await supabase
      .from("accounts")
      .select("id, is_active, merged_into_account_id")
      .eq("id", profile.id)
      .maybeSingle<{
        id: string;
        is_active?: boolean | null;
        merged_into_account_id?: string | null;
      }>();

    if (accountLookupError) {
      throw accountLookupError;
    }

    const resolvedAccountId =
      accountRow && accountRow.is_active === false && accountRow.merged_into_account_id
        ? accountRow.merged_into_account_id
        : profile.id;

    const { error: linkError } = await supabase
      .from("account_auth_links")
      .upsert(
        {
          account_id: resolvedAccountId,
          auth_user_id: authUserId,
          is_primary: true,
        },
        { onConflict: "auth_user_id" },
      );

    if (linkError) {
      throw linkError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const isCompatibilityTableMissing =
      (message.includes("accounts") || message.includes("account_auth_links")) &&
      (message.includes("does not exist") || message.includes("relation") || message.includes("schema"));

    if (!isCompatibilityTableMissing) {
      throw error;
    }
  }
}

export async function getProfileByAuthUserId(
  authUserId: string,
): Promise<ProfileRecord | null> {
  const supabase = createSupabaseAdminClient();

  const { data: accountLink, error: accountLinkError } = await supabase
    .from("account_auth_links")
    .select("account_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle<{ account_id: string }>();

  if (accountLinkError) {
    const message = accountLinkError.message?.toLowerCase() ?? "";
    const missingLinkTable =
      message.includes("account_auth_links") &&
      (message.includes("does not exist") || message.includes("relation") || message.includes("schema"));

    if (!missingLinkTable) {
      throw accountLinkError;
    }
  }

  if (accountLink?.account_id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", accountLink.account_id)
      .maybeSingle<ProfileRecord>();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRecord>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getOrCreateProfileByAuthUserId(authUserId: string): Promise<ProfileRecord> {
  const existing = await getProfileByAuthUserId(authUserId);

  if (existing?.id) {
    await syncAccountCompatibilityFromProfile(existing, authUserId);
    return existing;
  }

  const supabase = createSupabaseAdminClient();

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: authUserId, auth_user_id: authUserId })
    .select("id, username, display_name")
    .maybeSingle<ProfileRecord>();

  if (insertError) {
    throw insertError;
  }

  if (!inserted?.id) {
    throw new Error("Failed to create profile");
  }

  await syncAccountCompatibilityFromProfile(inserted, authUserId);

  return inserted;
}

export async function resolveProfileDefaultDisplayName(authUserId: string): Promise<string> {
  const profile = await getOrCreateProfileByAuthUserId(authUserId);
  const normalizedUsername = normalizeUsernameInput(profile.username ?? "");

  if (normalizedUsername.length >= 3) {
    return normalizedUsername;
  }

  const normalizedDisplayName = normalizeUsernameInput(profile.display_name ?? "");
  if (normalizedDisplayName.length >= 3) {
    return normalizedDisplayName;
  }

  return buildFallbackUsernameFromId(profile.id);
}

/**
 * Compatibility-phase canonical identity resolver for write paths.
 * Ensures a profile exists, then resolves canonical account id from account_auth_links with fallback.
 */
export async function resolveCanonicalAccountIdForAuthUserId(authUserId: string): Promise<string> {
  const profile = await getOrCreateProfileByAuthUserId(authUserId);
  const resolvedAccount = await resolveAccountIdForAuthUserId(authUserId);

  return resolvedAccount.accountId || profile.id;
}