"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import {
  validateRecordedEvent,
  type TeamSelection,
} from "../../lib/binga/event-logic";
import {
  calculateCardProgress,
  type CompletionMode,
  type CardCell as ProgressCardCell,
  type RecordedEvent,
} from "../../lib/binga/card-progress";

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
    .select("id, status, completion_mode, end_condition, team_scope")
    .eq("slug", parsed.data.slug)
    .maybeSingle<{
      id: string;
      status: string;
      completion_mode: CompletionMode;
      end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
      team_scope: "both_teams" | "team_a_only" | "team_b_only";
    }>();

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

  const { data: scoredEventsAfter, error: scoredEventsAfterError } = await supabase
    .from("scored_events")
    .select("id, event_key, team_key, created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (scoredEventsAfterError) {
    return { error: formatError(scoredEventsAfterError), completedAt: new Date().toISOString() };
  }

  const allEventsAfter: Array<{ id: string; event_key: string | null; team_key: string | null }> =
    (scoredEventsAfter as Array<{ id: string; event_key: string | null; team_key: string | null }> | null) ?? [];

  const recordedEventsAfter: RecordedEvent[] = allEventsAfter.map((event) => ({
    event_key: event.event_key,
    team_key: event.team_key,
  }));

  const recordedEventsBefore: RecordedEvent[] = allEventsAfter
    .filter((event) => event.id !== inserted.id)
    .map((event) => ({
      event_key: event.event_key,
      team_key: event.team_key,
    }));

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, player_id, card_cells(order_index, event_key, team_key, point_value)")
    .eq("game_id", game.id);

  if (cardsError) {
    return { error: formatError(cardsError), completedAt: new Date().toISOString() };
  }

  const completionTransitions: Array<{ game_id: string; player_id: string; completed_at_event_id: string }> =
    [];

  for (const card of cards ?? []) {
    const playerId = typeof card.player_id === "string" ? card.player_id : null;
    if (!playerId) {
      continue;
    }

    const progressCells: ProgressCardCell[] = (card.card_cells ?? []).map((cell: Record<string, unknown>) => ({
      event_key: typeof cell.event_key === "string" ? cell.event_key : null,
      team_key: typeof cell.team_key === "string" ? cell.team_key : null,
      order_index: typeof cell.order_index === "number" ? cell.order_index : null,
      point_value: typeof cell.point_value === "number" ? cell.point_value : null,
    }));

    const beforeProgress = calculateCardProgress(
      recordedEventsBefore,
      progressCells,
      game.completion_mode,
    );
    const afterProgress = calculateCardProgress(
      recordedEventsAfter,
      progressCells,
      game.completion_mode,
    );

    if (!beforeProgress.is_complete && afterProgress.is_complete) {
      completionTransitions.push({
        game_id: game.id,
        player_id: playerId,
        completed_at_event_id: inserted.id,
      });
    }
  }

  if (completionTransitions.length > 0) {
    const { data: existingCompletions, error: existingCompletionsError } = await supabase
      .from("game_completions")
      .select("player_id")
      .eq("game_id", game.id);

    if (existingCompletionsError) {
      return { error: formatError(existingCompletionsError), completedAt: new Date().toISOString() };
    }

    const alreadyCompletedPlayerIds = new Set(
      ((existingCompletions as Array<{ player_id: string }> | null) ?? [])
        .map((row) => row.player_id)
        .filter((playerId): playerId is string => Boolean(playerId)),
    );

    const rowsToInsert = completionTransitions.filter(
      (row) => !alreadyCompletedPlayerIds.has(row.player_id),
    );

    if (rowsToInsert.length > 0) {
      const { error: completionInsertError } = await supabase
        .from("game_completions")
        .insert(rowsToInsert);

      if (completionInsertError && completionInsertError.code !== "23505") {
        return { error: formatError(completionInsertError), completedAt: new Date().toISOString() };
      }
    }
  }

  const currentTime = new Date().toISOString();

  if (game.end_condition === "FIRST_COMPLETION" && completionTransitions.length > 0) {
    const { error: updateError } = await supabase
      .from("games")
      .update({
        status: "finished",
        completed_at: currentTime,
      })
      .eq("id", game.id)
      .neq("status", "finished");

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