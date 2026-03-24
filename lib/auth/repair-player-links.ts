import { createSupabaseAdminClient } from "../supabase/admin";

export type HostBackfillResult = {
  attempted: boolean;
  updatedCount: number;
  skippedReason?: "games_auth_user_id_column_missing" | "query_error";
  errorMessage?: string;
};

/**
 * Backfills host player.profile_id for games that carry a trustworthy owner key.
 * Preference order in compatibility phase: games.account_id, then games.auth_user_id.
 * Safe behavior:
 * - only host rows with NULL profile_id
 * - only when matching profile exists
 * - only first host row per game (by created_at/id)
 * - skips games where another player already uses that profile_id
 */
export async function backfillHostProfileLinksFromGamesAuthUserId(): Promise<HostBackfillResult> {
  const supabase = createSupabaseAdminClient();

  let games: Array<{ id: string; account_id?: string | null; auth_user_id?: string | null }> = [];

  try {
    const { data, error } = await supabase
      .from("games")
      .select("id, account_id, auth_user_id");

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("auth_user_id") && (message.includes("column") || message.includes("schema"))) {
        return {
          attempted: false,
          updatedCount: 0,
          skippedReason: "games_auth_user_id_column_missing",
        };
      }

      return {
        attempted: false,
        updatedCount: 0,
        skippedReason: "query_error",
        errorMessage: error.message,
      };
    }

    games = (data as Array<{ id: string; account_id?: string | null; auth_user_id?: string | null }> | null) ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes("auth_user_id") && message.toLowerCase().includes("column")) {
      return {
        attempted: false,
        updatedCount: 0,
        skippedReason: "games_auth_user_id_column_missing",
      };
    }

    return {
      attempted: false,
      updatedCount: 0,
      skippedReason: "query_error",
      errorMessage: message,
    };
  }

  const gameOwnerPairs = games
    .map((row) => ({
      gameId: row.id,
      profileId: row.account_id || row.auth_user_id || null,
    }))
    .filter((row) => row.gameId && row.profileId)
    .map((row) => ({ gameId: row.gameId, profileId: row.profileId as string }));

  let updatedCount = 0;

  for (const pair of gameOwnerPairs) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", pair.profileId)
      .maybeSingle<{ id: string }>();

    if (!profile?.id) {
      continue;
    }

    const { data: conflictingPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("game_id", pair.gameId)
      .eq("profile_id", pair.profileId)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (conflictingPlayer?.id) {
      continue;
    }

    const { data: hostToLink } = await supabase
      .from("players")
      .select("id, profile_id")
      .eq("game_id", pair.gameId)
      .eq("role", "host")
      .is("profile_id", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; profile_id: string | null }>();

    if (!hostToLink?.id) {
      continue;
    }

    const { data: updated } = await supabase
      .from("players")
      .update({ profile_id: pair.profileId })
      .eq("id", hostToLink.id)
      .is("profile_id", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updated?.id) {
      updatedCount += 1;
    }
  }

  return {
    attempted: true,
    updatedCount,
  };
}
