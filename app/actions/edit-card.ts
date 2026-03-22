"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type EditCardFormState = {
  success?: boolean;
  error?: string;
};

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function editCardAction(
  _prevState: EditCardFormState,
): Promise<EditCardFormState> {
  const cookieStore = await cookies();
  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  if (!cookiePlayerId) {
    return { error: "Missing player session" };
  }

  const supabase = createSupabaseAdminClient();

  try {
    const { data: playerRecord, error: playerError } = await supabase
      .from("players")
      .select("game_id, games!players_game_id_fkey(status, slug)")
      .eq("id", cookiePlayerId)
      .maybeSingle<{
        game_id?: string;
        games?: { status?: "lobby" | "live" | "finished"; slug?: string };
      }>();

    if (playerError) {
      throw playerError;
    }

    const gameId = playerRecord?.game_id;
    const gameStatus = playerRecord?.games?.status;

    if (!gameId) {
      throw new Error("Player is not associated with an active game.");
    }

    if (gameStatus !== "lobby") {
      return { error: "Card cannot be edited after game start." };
    }

    const { error: clearAcceptedAtError } = await supabase
      .from("cards")
      .update({ accepted_at: null })
      .eq("game_id", gameId)
      .eq("player_id", cookiePlayerId);

    if (clearAcceptedAtError) {
      throw clearAcceptedAtError;
    }

    const slug = playerRecord?.games?.slug;
    if (slug) {
      revalidatePath(`/g/${slug}/play`);
    }

    return { success: true };
  } catch (error) {
    return { error: formatError(error) };
  }
}