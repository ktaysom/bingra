"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import {
  validateRecordedEvent,
  type TeamSelection,
} from "../../lib/binga/event-logic";
import { evaluateCardWin, type CardCell } from "../../lib/binga/winner";

export type RecordEventFormState = {
  error?: string;
  success?: boolean;
  recordedEventId?: string;
  completedAt?: string;
  blocked?: boolean;
  blockedReason?: string;
};

const recordEventSchema = z.object({
  slug: z.string().min(1, "Missing game slug"),
  eventKey: z.string().min(1, "Missing event key"),
  team: z.union([
    z.literal("A"),
    z.literal("B"),
    z.null(),
  ]).optional(),
});

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "Unknown error");
  }
}

export async function recordEventAction(
  _prevState: RecordEventFormState,
  formData: FormData
): Promise<RecordEventFormState> {
  const rawSlug = formData.get("slug");
  const rawEventKey = formData.get("eventKey");
  const rawTeam = formData.get("team");

  const parsed = recordEventSchema.safeParse({
    slug: typeof rawSlug === "string" ? rawSlug.trim() : "",
    eventKey: typeof rawEventKey === "string" ? rawEventKey.trim() : "",
    team:
      rawTeam === "A" || rawTeam === "B" ? rawTeam : null,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid submission",
      completedAt: new Date().toISOString(),
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status")
    .eq("slug", parsed.data.slug)
    .maybeSingle<{ id: string; status: string }>();

  if (gameError) {
    return { error: formatError(gameError), completedAt: new Date().toISOString() };
  }

  if (!game) {
    return { error: "Game not found", completedAt: new Date().toISOString() };
  }

  if (game.status === "finished") {
    const blockedAt = new Date().toISOString();
    return {
      error: "Game already completed",
      blocked: true,
      blockedReason: "Game already completed",
      completedAt: blockedAt,
    };
  }

  const validation = validateRecordedEvent({
    eventId: parsed.data.eventKey,
    team: parsed.data.team as TeamSelection | undefined,
  });

  if (!validation.valid) {
    const reason = (validation as { valid: false; reason: string }).reason;
    return { error: reason, completedAt: new Date().toISOString() };
  }

  const insertPayload: Record<string, unknown> = {
    game_id: game.id,
    event_key: validation.event.id,
    event_label: validation.event.label,
    source: "manual",
  };

  if (parsed.data.team) {
    insertPayload.team_key = parsed.data.team;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("scored_events")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError) {
    const schemaHint = insertError.code === "PGRST204" ? " (schema mismatch: column missing)" : "";
    return {
      error: formatError(insertError) + schemaHint,
      completedAt: new Date().toISOString(),
    };
  }

  if (!inserted) {
    return {
      error: "Failed to record scored event",
      completedAt: new Date().toISOString(),
    };
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, player_id, card_cells(order_index, event_key)")
    .eq("game_id", game.id);

  if (cardsError) {
    return { error: formatError(cardsError), completedAt: new Date().toISOString() };
  }

  const { data: scoredEvents, error: scoredEventsError } = await supabase
    .from("scored_events")
    .select("event_key")
    .eq("game_id", game.id);

  if (scoredEventsError) {
    return { error: formatError(scoredEventsError), completedAt: new Date().toISOString() };
  }

  const satisfiedEventKeys = new Set(
    (scoredEvents ?? [])
      .map((event) => (typeof event.event_key === "string" ? event.event_key : null))
      .filter((eventKey): eventKey is string => Boolean(eventKey)),
  );

  const evaluated = (cards ?? [])
    .map((card) => {
      const cellRows = (card.card_cells ?? []).map((cell: Record<string, unknown>, idx: number) => {
        const eventKey = typeof cell.event_key === "string" ? cell.event_key : `cell-${idx}`;

        return {
          eventKey,
          orderIndex: typeof cell.order_index === "number" ? cell.order_index : idx,
          marked: satisfiedEventKeys.has(eventKey),
        } satisfies CardCell;
      });

      return {
        playerId: card.player_id,
        cells: cellRows,
      };
    })
    .sort((a, b) => (a.playerId ?? "").localeCompare(b.playerId ?? ""));

  const currentTime = new Date().toISOString();
  let winnerPlayerId: string | null = null;

  for (const entry of evaluated) {
    if (!entry.playerId) {
      continue;
    }

    const result = evaluateCardWin(entry.cells);
    if (result.isWinner) {
      winnerPlayerId = entry.playerId;
      break;
    }
  }

  if (winnerPlayerId) {
    const { error: updateError } = await supabase
      .from("games")
      .update({
        status: "finished",
        winner_player_id: winnerPlayerId,
        completed_at: currentTime,
      })
      .eq("id", game.id)
      .eq("status", game.status);

    if (updateError) {
      return {
        error: formatError(updateError),
        completedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      recordedEventId: inserted.id,
      completedAt: currentTime,
    };
  }

  return {
    success: true,
    recordedEventId: inserted.id,
    completedAt: new Date().toISOString(),
  };
}