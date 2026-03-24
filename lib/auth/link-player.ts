import { createSupabaseAdminClient } from "../supabase/admin";
import { resolveCanonicalAccountIdForAuthUserId } from "./profiles";

type LinkGuestPlayerResult = {
  linked: boolean;
  reason:
    | "linked"
    | "already_linked"
    | "player_not_found"
    | "player_linked_to_different_profile"
    | "profile_already_has_player_for_game"
    | "link_race_lost";
};

export async function linkGuestPlayerToProfile(params: {
  playerId: string;
  profileId: string;
}): Promise<LinkGuestPlayerResult> {
  const { playerId, profileId } = params;
  const supabase = createSupabaseAdminClient();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, game_id, profile_id")
    .eq("id", playerId)
    .maybeSingle<{ id: string; game_id: string; profile_id: string | null }>();

  if (playerError) {
    throw playerError;
  }

  if (!player?.id) {
    return { linked: false, reason: "player_not_found" };
  }

  if (player.profile_id === profileId) {
    return { linked: true, reason: "already_linked" };
  }

  if (player.profile_id && player.profile_id !== profileId) {
    return { linked: false, reason: "player_linked_to_different_profile" };
  }

  const { data: existingInGame, error: existingInGameError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", player.game_id)
    .eq("profile_id", profileId)
    .neq("id", player.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingInGameError) {
    throw existingInGameError;
  }

  if (existingInGame?.id) {
    return { linked: false, reason: "profile_already_has_player_for_game" };
  }

  const { data: linkedPlayer, error: linkError } = await supabase
    .from("players")
    .update({ profile_id: profileId })
    .eq("id", player.id)
    .is("profile_id", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (linkError) {
    throw linkError;
  }

  if (!linkedPlayer?.id) {
    const { data: reloaded, error: reloadError } = await supabase
      .from("players")
      .select("profile_id")
      .eq("id", player.id)
      .maybeSingle<{ profile_id: string | null }>();

    if (reloadError) {
      throw reloadError;
    }

    if (reloaded?.profile_id === profileId) {
      return { linked: true, reason: "already_linked" };
    }

    return { linked: false, reason: "link_race_lost" };
  }

  return { linked: true, reason: "linked" };
}

export async function ensurePlayerLinkedToAuthenticatedUser(params: {
  playerId: string;
  authUserId: string;
  context: string;
}): Promise<LinkGuestPlayerResult> {
  const { playerId, authUserId, context } = params;
  const accountId = await resolveCanonicalAccountIdForAuthUserId(authUserId);
  const result = await linkGuestPlayerToProfile({
    playerId,
    profileId: accountId,
  });

  if (!result.linked) {
    console.warn("[ensurePlayerLinkedToAuthenticatedUser] unable to link player", {
      context,
      playerId,
      authUserId,
      accountId,
      reason: result.reason,
    });
  }

  return result;
}