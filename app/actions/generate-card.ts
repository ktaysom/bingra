"use server";

import { cookies } from "next/headers";
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
import { isThresholdLevelAllowedForEvent } from "../../lib/bingra/threshold-levels";

export type GenerateCardFormState = {
  success?: boolean;
  error?: string;
  cardId?: string;
  acceptedAt?: string;
  gameSlug?: string;
};

const inputSchema = z.object({
  playerId: z.string().uuid().optional(),
  gameSlug: z.string().min(1).optional(),
  sportProfile: z.string().min(1).optional(),
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
  const startedAt = Date.now();
  const logTiming = (segment: string, segmentStartedAt: number, extra?: Record<string, unknown>) => {
    console.info("[generateCardAction][timing]", {
      segment,
      durationMs: Date.now() - segmentStartedAt,
      totalDurationMs: Date.now() - startedAt,
      ...(extra ?? {}),
    });
  };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    logTiming("validation-failed", startedAt, {
      error: parsed.error.issues[0]?.message ?? "Invalid card payload",
    });
    return { error: parsed.error.issues[0]?.message ?? "Invalid card payload" };
  }

  const cookieStoreStartedAt = Date.now();
  const cookieStore = await cookies();
  logTiming("cookies-store-resolve", cookieStoreStartedAt);
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
    logTiming("accepted-events-parse", startedAt, {
      acceptedEventsCount: acceptedEvents.length,
      hasLockEventKey: Boolean(parsed.data.lockEventKey),
      hasPlayerId: Boolean(parsed.data.playerId),
      hasGameSlug: Boolean(parsed.data.gameSlug?.trim()),
    });

    if (!acceptedEvents.length) {
      throw new Error("No accepted card events were provided.");
    }

    const gameSlug = parsed.data.gameSlug?.trim();
    if (!gameSlug) {
      throw new Error("Missing game slug.");
    }

    const sportProfile = resolveSportProfileKey(parsed.data.sportProfile ?? null);

    const validationStartedAt = Date.now();
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

      const submittedLevel =
        typeof acceptedEvent.threshold === "number" && Number.isFinite(acceptedEvent.threshold)
          ? acceptedEvent.threshold
          : 1;

      if (!isThresholdLevelAllowedForEvent(catalogEvent, sportProfile, submittedLevel)) {
        throw new Error(
          `Threshold level ${Math.ceil(submittedLevel)} is not allowed for ${baseEventKey} in this game profile.`,
        );
      }
    }
    logTiming("accepted-events-validate", validationStartedAt, {
      acceptedEventsCount: acceptedEvents.length,
      sportProfile,
    });

    const cellsPayloadStartedAt = Date.now();
    const cellsPayload = buildCardCellsPayload({
      cardId: "00000000-0000-0000-0000-000000000000",
      acceptedEvents,
      lockEventKey: parsed.data.lockEventKey,
    });

    assertUniqueCardCellEventKeys(cellsPayload.map((cell) => cell.event_key));
    logTiming("card-cells-payload-build", cellsPayloadStartedAt, {
      cellCount: cellsPayload.length,
      firstEventKey: cellsPayload[0]?.event_key ?? null,
      lastEventKey: cellsPayload.at(-1)?.event_key ?? null,
    });

    console.info("[generateCardAction] dispatching lock_player_card RPC", {
      playerId: cookiePlayerId,
      gameSlug,
      targetCount: parsed.data.targetCount ?? acceptedEvents.length,
      selectionMode: parsed.data.selectionMode ?? "custom",
      cellCount: cellsPayload.length,
    });
    const rpcStartedAt = Date.now();
    const { data: lockedCard, error: lockCardError } = await supabase
      .rpc("lock_player_card", {
        p_player_id: cookiePlayerId,
        p_game_slug: gameSlug,
        p_target_count: parsed.data.targetCount ?? acceptedEvents.length,
        p_selection_mode: parsed.data.selectionMode ?? "custom",
        p_card_cells: cellsPayload.map(({ card_id: _ignoredCardId, ...cell }) => cell),
      })
      .maybeSingle<{ card_id: string; game_slug: string; accepted_at: string }>();
    logTiming("lock-player-card-rpc", rpcStartedAt, {
      hasCardId: Boolean(lockedCard?.card_id),
      hasError: Boolean(lockCardError),
      cellCount: cellsPayload.length,
      errorCode: lockCardError?.code ?? null,
      errorMessage: lockCardError?.message ?? null,
    });

    if (lockCardError) {
      console.error("[generateCardAction] lock_player_card RPC error", {
        playerId: cookiePlayerId,
        gameSlug,
        code: lockCardError.code,
        message: lockCardError.message,
        details: lockCardError.details,
        hint: lockCardError.hint,
      });
      throw lockCardError;
    }

    if (!lockedCard?.card_id) {
      throw new Error("Failed to lock card.");
    }

    logTiming("action-complete", startedAt, {
      success: true,
      cardId: lockedCard.card_id,
      acceptedAt: lockedCard.accepted_at,
      gameSlug: lockedCard.game_slug,
    });
    return {
      success: true,
      cardId: lockedCard.card_id,
      acceptedAt: lockedCard.accepted_at,
      gameSlug: lockedCard.game_slug,
    };
  } catch (error) {
    console.error("[generateCardAction] failed", {
      playerId: cookiePlayerId,
      error: formatError(error),
      inputSummary: {
        gameSlug: parsed.data.gameSlug ?? null,
        acceptedEventsCount: parsed.data.acceptedEvents?.length ?? 0,
        selectionMode: parsed.data.selectionMode ?? null,
      },
    });
    return { error: formatError(error) };
  }
}
