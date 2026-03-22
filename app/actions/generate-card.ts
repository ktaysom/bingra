"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import {
  assertUniqueCardCellEventKeys,
  parseCardCellEventKey,
} from "../../lib/bingra/card-event-key";
import {
  getEventById,
  isEventEnabledForProfile,
} from "../../lib/bingra/event-logic";
import { resolveSportProfileKey } from "../../lib/bingra/sport-profiles";
import { buildCardCellsPayload } from "../../lib/bingra/card-cells-payload";

export type GenerateCardFormState = {
  success?: boolean;
  error?: string;
  cardId?: string;
};

const inputSchema = z.object({
  playerId: z.string().uuid().optional(),
  targetCount: z.number().int().positive().optional(),
  selectedEventKeys: z.array(z.string().min(1)).optional(),
  acceptedEvents: z
    .array(
      z.object({
        eventId: z.string().min(1).optional(),
        eventKey: z.string().min(1),
        eventLabel: z.string().min(1),
        pointValue: z.number(),
        team: z.union([z.literal("A"), z.literal("B"), z.null()]).optional(),
        teamKey: z.union([z.literal("A"), z.literal("B"), z.null()]).optional(),
        threshold: z.number().finite().positive().optional(),
        orderIndex: z.number().int().nonnegative().optional(),
      }),
    )
    .optional(),
  lockEventKey: z.string().min(1).nullable().optional(),
  selectionMode: z.enum(["random", "custom", "mixed"]).optional(),
});

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

export async function generateCardAction(
  _prevState: GenerateCardFormState,
  input: unknown,
): Promise<GenerateCardFormState> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid card payload" };
  }

  const cookieStore = await cookies();
  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  if (!cookiePlayerId) {
    return { error: "Missing player session" };
  }

  if (parsed.data.playerId && parsed.data.playerId !== cookiePlayerId) {
    return { error: "Player identity mismatch" };
  }

  const supabase = createSupabaseAdminClient();

  try {
    const acceptedEvents = parsed.data.acceptedEvents ?? [];
    if (!acceptedEvents.length) {
      throw new Error("No accepted card events were provided.");
    }

    const { data: playerRecord, error: playerError } = await supabase
      .from("players")
      .select("game_id, games!players_game_id_fkey(slug, sport_profile)")
      .eq("id", cookiePlayerId)
      .maybeSingle<{ game_id?: string; games?: { slug?: string; sport_profile?: string | null } }>();

    if (playerError) {
      throw playerError;
    }

    const gameId = playerRecord?.game_id;
    const sportProfile = resolveSportProfileKey(playerRecord?.games?.sport_profile ?? null);
    if (!gameId) {
      throw new Error("Player is not associated with an active game.");
    }

    for (const acceptedEvent of acceptedEvents) {
      const parsedEventKey = parseCardCellEventKey(acceptedEvent.eventKey);
      const baseEventKey = parsedEventKey.baseEventKey;

      if (!baseEventKey) {
        continue;
      }

      const catalogEvent = getEventById(baseEventKey);
      if (!catalogEvent || !isEventEnabledForProfile(catalogEvent, sportProfile)) {
        throw new Error(`Event ${baseEventKey} is not enabled for this game profile.`);
      }
    }

    const { data: existingCards, error: existingCardsError } = await supabase
      .from("cards")
      .select("id")
      .eq("game_id", gameId)
      .eq("player_id", cookiePlayerId)
      .order("id", { ascending: true });

    if (existingCardsError) {
      throw existingCardsError;
    }

    let cardId = existingCards?.[0]?.id as string | undefined;
    const acceptedAt = new Date().toISOString();

    if (!cardId) {
      const resolvedTargetCount = parsed.data.targetCount ?? acceptedEvents.length;
      const { data: insertedCard, error: insertCardError } = await supabase
        .from("cards")
        .insert({
          game_id: gameId,
          player_id: cookiePlayerId,
          target_count: resolvedTargetCount,
          selection_mode: parsed.data.selectionMode ?? "custom",
          accepted_at: acceptedAt,
        })
        .select("id")
        .maybeSingle<{ id: string }>();

      if (insertCardError) {
        throw insertCardError;
      }

      cardId = insertedCard?.id;
    }

    if (!cardId) {
      throw new Error("Failed to create or load card.");
    }

    const { error: deleteCellsError } = await supabase
      .from("card_cells")
      .delete()
      .eq("card_id", cardId);

    if (deleteCellsError) {
      throw deleteCellsError;
    }

    const cellsPayload = buildCardCellsPayload({
      cardId,
      acceptedEvents,
      lockEventKey: parsed.data.lockEventKey,
    });

    assertUniqueCardCellEventKeys(cellsPayload.map((cell) => cell.event_key));

    const { error: insertCellsError } = await supabase
      .from("card_cells")
      .insert(cellsPayload);

    if (insertCellsError) {
      throw insertCellsError;
    }

    const { error: updateCardError } = await supabase
      .from("cards")
      .update({
        target_count: parsed.data.targetCount ?? acceptedEvents.length,
        selection_mode: parsed.data.selectionMode ?? "custom",
        accepted_at: acceptedAt,
      })
      .eq("id", cardId)
      .limit(1);

    if (updateCardError) {
      throw updateCardError;
    }

    const slug = playerRecord?.games?.slug;
    if (slug) {
      revalidatePath(`/g/${slug}/play`);
    }

    return {
      success: true,
      cardId,
    };
  } catch (error) {
    return { error: formatError(error) };
  }
}