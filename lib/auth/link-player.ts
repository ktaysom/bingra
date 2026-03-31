import { createSupabaseAdminClient } from "../supabase/admin";
import {
  buildFallbackUsernameFromId,
  normalizeUsernameInput,
  resolveCanonicalAccountIdForAuthUserId,
} from "./profiles";
import { rebuildCareerStatsFromCanonicalHistory } from "../bingra/rebuild-career-stats";

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

function buildLegacyProfileFallbackUsername(id: string): string {
  return `player-${id.replace(/-/g, "").toLowerCase().slice(0, 4)}`;
}

function hasMeaningfulUsername(username: string | null | undefined, profileId: string): boolean {
  const normalized = normalizeUsernameInput(username ?? "");
  if (normalized.length < 3) {
    return false;
  }

  const canonicalFallback = normalizeUsernameInput(buildFallbackUsernameFromId(profileId));
  const legacyFallback = normalizeUsernameInput(buildLegacyProfileFallbackUsername(profileId));

  return normalized !== canonicalFallback && normalized !== legacyFallback;
}

async function importInitialUsernameFromPlayerDisplayName(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  profileId: string;
  playerDisplayName: string | null;
}) {
  const normalizedCandidate = normalizeUsernameInput(params.playerDisplayName ?? "");
  if (normalizedCandidate.length < 3) {
    return;
  }

  const { data: profile, error: profileError } = await params.supabase
    .from("profiles")
    .select("id, username")
    .eq("id", params.profileId)
    .maybeSingle<{ id: string; username: string | null }>();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.id) {
    return;
  }

  if (hasMeaningfulUsername(profile.username, params.profileId)) {
    return;
  }

  const currentUsername = profile.username ?? "";
  if (normalizeUsernameInput(currentUsername) === normalizedCandidate) {
    return;
  }

  const { error: updateError } = await params.supabase
    .from("profiles")
    .update({ username: normalizedCandidate })
    .eq("id", params.profileId)
    .eq("username", currentUsername)
    .limit(1);

  if (!updateError) {
    return;
  }

  if ((updateError as { code?: string }).code === "23505") {
    // Candidate collides with an existing username. Keep existing fallback/default username.
    return;
  }

  throw updateError;
}

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
  accountId?: string;
  context: string;
}): Promise<LinkGuestPlayerResult> {
  const { playerId, authUserId, context } = params;
  const supabase = createSupabaseAdminClient();
  const accountId =
    params.accountId ?? (await resolveCanonicalAccountIdForAuthUserId(authUserId));
  const result = await linkGuestPlayerToProfile({
    playerId,
    profileId: accountId,
  });

  if (result.linked) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, game_id, display_name")
      .eq("id", playerId)
      .maybeSingle<{ id: string; game_id: string | null; display_name: string | null }>();

    if (playerError) {
      throw playerError;
    }

    if (player?.game_id) {
      await importInitialUsernameFromPlayerDisplayName({
        supabase,
        profileId: accountId,
        playerDisplayName: player.display_name,
      });

      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, status")
        .eq("id", player.game_id)
        .maybeSingle<{ id: string; status: "lobby" | "live" | "finished" | null }>();

      if (gameError) {
        throw gameError;
      }

      if (game?.status === "finished") {
        await rebuildCareerStatsFromCanonicalHistory({
          supabase,
          profileIds: [accountId],
        });
      }
    }
  }

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