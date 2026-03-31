import { createSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";
import { resolveCanonicalAccountIdForAuthUserId } from "./profiles";

type GameAuthorityRow = {
  id: string;
  slug: string;
  status: "lobby" | "live" | "finished";
  restricted_scoring: boolean;
  host_account_id: string | null;
};

export type HostAuthorizationResult = {
  gameId: string;
  slug: string;
  status: "lobby" | "live" | "finished";
  restrictedScoring: boolean;
  hostAccountId: string | null;
  actorAccountId: string | null;
};

export async function assertHostAuthorized(gameSlug: string): Promise<HostAuthorizationResult> {
  const supabase = createSupabaseAdminClient();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, slug, status, restricted_scoring, host_account_id")
    .eq("slug", gameSlug)
    .maybeSingle<GameAuthorityRow>();

  if (gameError) {
    throw new Error(gameError.message || "Unable to load game");
  }

  if (!game) {
    throw new Error("Game not found");
  }

  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  let actorAccountId: string | null = null;
  if (user?.id) {
    actorAccountId = await resolveCanonicalAccountIdForAuthUserId(user.id);
  }

  if (game.restricted_scoring) {
    if (!user?.id || !actorAccountId) {
      throw new Error("You must be signed in as the host to perform this action.");
    }

    if (!game.host_account_id) {
      throw new Error("Host ownership is not configured for this game.");
    }

    if (actorAccountId !== game.host_account_id) {
      throw new Error("Only the host can perform this action.");
    }
  }

  return {
    gameId: game.id,
    slug: game.slug,
    status: game.status,
    restrictedScoring: game.restricted_scoring,
    hostAccountId: game.host_account_id,
    actorAccountId,
  };
}
