import { createSupabaseAdminClient } from "../supabase/admin";

export type ProfileRecord = {
  id: string;
  auth_user_id: string;
};

export async function getProfileByAuthUserId(
  authUserId: string,
): Promise<ProfileRecord | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id")
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
    return existing;
  }

  const supabase = createSupabaseAdminClient();

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ auth_user_id: authUserId })
    .select("id, auth_user_id")
    .maybeSingle<ProfileRecord>();

  if (insertError) {
    throw insertError;
  }

  if (!inserted?.id) {
    throw new Error("Failed to create profile");
  }

  return inserted;
}