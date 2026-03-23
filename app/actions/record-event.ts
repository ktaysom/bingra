"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import {
  validateRecordedEvent,
  type TeamSelection,
} from "../../lib/bingra/event-logic";
import {
  getSportProfileDefinition,
  resolveSportProfileKey,
} from "../../lib/bingra/sport-profiles";
import {
  SOCCER_CAUSE_TYPES,
  SOCCER_OUTCOME_TYPES,
  interpretSoccerScoringInput,
} from "../../lib/bingra/soccer-scoring";
import {
  calculateCardProgress,
  filterRecordedEventsByAcceptedAt,
  normalizeCardCells,
  type CompletionMode,
  type CardCell as ProgressCardCell,
  type RecordedEvent,
} from "../../lib/bingra/card-progress";
import { finalizeGameAndSetWinner } from "../../lib/bingra/finalize-game";

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
  eventKey: z.string().min(1).optional(),
  sportProfile: z.string().optional(),
  causeType: z.enum(SOCCER_CAUSE_TYPES).optional(),
  outcomeType: z.enum(SOCCER_OUTCOME_TYPES).optional(),
  causingTeam: z.union([z.literal("A"), z.literal("B"), z.null()]).optional(),
  beneficiaryTeam: z.union([z.literal("A"), z.literal("B"), z.null()]).optional(),
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
  const actionStartedAt = Date.now();
  const rawSlug = formData.get("slug");
  const rawEventKey = formData.get("eventKey");
  const rawSportProfile = formData.get("sportProfile");
  const rawTeam = formData.get("team");
  const rawCauseType = formData.get("causeType");
  const rawOutcomeType = formData.get("outcomeType");
  const rawCausingTeam = formData.get("causingTeam");
  const rawBeneficiaryTeam = formData.get("beneficiaryTeam");

  console.info("[recordEventAction][perf] action start", {
    startedAt: new Date(actionStartedAt).toISOString(),
    slug: typeof rawSlug === "string" ? rawSlug.trim() : "",
    eventKey: typeof rawEventKey === "string" ? rawEventKey.trim() : "",
    team: rawTeam === "A" || rawTeam === "B" ? rawTeam : null,
  });

  const logTotalDuration = () => {
    console.info("[recordEventAction][perf] total action duration", {
      durationMs: Date.now() - actionStartedAt,
    });
  };

  const parsed = recordEventSchema.safeParse({
    slug: typeof rawSlug === "string" ? rawSlug.trim() : "",
    eventKey:
      typeof rawEventKey === "string" && rawEventKey.trim().length > 0
        ? rawEventKey.trim()
        : undefined,
    sportProfile: typeof rawSportProfile === "string" ? rawSportProfile : undefined,
    causeType:
      typeof rawCauseType === "string" ? rawCauseType : undefined,
    outcomeType:
      typeof rawOutcomeType === "string" ? rawOutcomeType : undefined,
    causingTeam:
      rawCausingTeam === "A" || rawCausingTeam === "B" ? rawCausingTeam : null,
    beneficiaryTeam:
      rawBeneficiaryTeam === "A" || rawBeneficiaryTeam === "B" ? rawBeneficiaryTeam : null,
    team:
      rawTeam === "A" || rawTeam === "B" ? rawTeam : null,
  });

  if (!parsed.success) {
    logTotalDuration();
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid submission",
      completedAt: new Date().toISOString(),
    };
  }

  const supabase = createSupabaseAdminClient();

  const gameLookupStartedAt = Date.now();
  console.info("[recordEventAction][perf] game lookup start", {
    slug: parsed.data.slug,
  });
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status, completion_mode, end_condition, team_scope, sport_profile")
    .eq("slug", parsed.data.slug)
    .maybeSingle<{
      id: string;
      status: string;
      completion_mode: CompletionMode;
      end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
      team_scope: "both_teams" | "team_a_only" | "team_b_only";
      sport_profile: string | null;
    }>();
  console.info("[recordEventAction][perf] game lookup end", {
    durationMs: Date.now() - gameLookupStartedAt,
    foundGame: Boolean(game?.id),
  });

  if (gameError) {
    logTotalDuration();
    return { error: formatError(gameError), completedAt: new Date().toISOString() };
  }

  if (!game) {
    logTotalDuration();
    return { error: "Game not found", completedAt: new Date().toISOString() };
  }

  if (game.status !== "live") {
    const blockedAt = new Date().toISOString();
    const blockedReason =
      game.status === "lobby"
        ? "Game has not started yet"
        : "Game already completed";

    logTotalDuration();
    return {
      error: blockedReason,
      blocked: true,
      blockedReason,
      completedAt: blockedAt,
    };
  }

  const resolvedProfile = resolveSportProfileKey(parsed.data.sportProfile ?? game.sport_profile);
  const resolvedSport = getSportProfileDefinition(resolvedProfile).sport;

  let compatibleEventKey = parsed.data.eventKey;
  let compatibleTeam = parsed.data.team as TeamSelection | undefined;

  if (resolvedSport === "soccer" && parsed.data.causeType) {
    try {
      const interpreted = interpretSoccerScoringInput({
        legacyEventKey: parsed.data.eventKey,
        legacyTeamKey: (parsed.data.team as TeamSelection) ?? null,
        causeType: parsed.data.causeType,
        outcomeType: parsed.data.outcomeType,
        causingTeamKey: (parsed.data.causingTeam as TeamSelection) ?? null,
        beneficiaryTeamKey: (parsed.data.beneficiaryTeam as TeamSelection) ?? null,
      });

      compatibleEventKey = interpreted.eventKey;
      compatibleTeam = interpreted.compatibilityTeamKey;
    } catch (error) {
      logTotalDuration();
      return {
        error: formatError(error),
        completedAt: new Date().toISOString(),
      };
    }
  }

  if (!compatibleEventKey) {
    logTotalDuration();
    return {
      error: "Missing event key",
      completedAt: new Date().toISOString(),
    };
  }

  const validation = validateRecordedEvent({
    eventId: compatibleEventKey,
    team: compatibleTeam,
    profile: resolvedProfile,
  });

  if (!validation.valid) {
    const reason = (validation as { valid: false; reason: string }).reason;
    logTotalDuration();
    return { error: reason, completedAt: new Date().toISOString() };
  }

  const insertPayload: Record<string, unknown> = {
    game_id: game.id,
    event_key: validation.event.id,
    event_label: validation.event.label,
    source: "manual",
    created_at: new Date().toISOString(),
  };

  if (compatibleTeam) {
    insertPayload.team_key = compatibleTeam;
  }

  const scoredEventInsertStartedAt = Date.now();
  console.info("[recordEventAction][perf] scored_events insert start", {
    gameId: game.id,
    eventKey: validation.event.id,
  });
  const { data: inserted, error: insertError } = await supabase
    .from("scored_events")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();
  console.info("[recordEventAction][perf] scored_events insert end", {
    durationMs: Date.now() - scoredEventInsertStartedAt,
    insertedEventId: inserted?.id ?? null,
  });

  if (insertError) {
    const schemaHint = insertError.code === "PGRST204" ? " (schema mismatch: column missing)" : "";
    logTotalDuration();
    return {
      error: formatError(insertError) + schemaHint,
      completedAt: new Date().toISOString(),
    };
  }

  if (!inserted) {
    logTotalDuration();
    return {
      error: "Failed to record scored event",
      completedAt: new Date().toISOString(),
    };
  }

  const scoredEventsReadStartedAt = Date.now();
  console.info("[recordEventAction][perf] scored_events read start", { gameId: game.id });
  const { data: scoredEventsAfter, error: scoredEventsAfterError } = await supabase
    .from("scored_events")
    .select("id, event_key, team_key, created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  console.info("[recordEventAction][perf] scored_events read end", {
    durationMs: Date.now() - scoredEventsReadStartedAt,
    rowCount: scoredEventsAfter?.length ?? 0,
  });

  if (scoredEventsAfterError) {
    logTotalDuration();
    return { error: formatError(scoredEventsAfterError), completedAt: new Date().toISOString() };
  }

  const allEventsAfter: Array<{
    id: string;
    event_key: string | null;
    team_key: string | null;
    created_at: string | null;
  }> =
    (scoredEventsAfter as Array<{
      id: string;
      event_key: string | null;
      team_key: string | null;
      created_at: string | null;
    }> | null) ?? [];

  const recordedEventsAfter: RecordedEvent[] = allEventsAfter.map((event) => ({
    event_key: event.event_key,
    team_key: event.team_key,
    created_at: event.created_at,
  }));

  const recordedEventsBefore: RecordedEvent[] = allEventsAfter
    .filter((event) => event.id !== inserted.id)
    .map((event) => ({
      event_key: event.event_key,
      team_key: event.team_key,
      created_at: event.created_at,
    }));

  const cardsReadStartedAt = Date.now();
  console.info("[recordEventAction][perf] cards read start", { gameId: game.id });
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, player_id, accepted_at, card_cells(order_index, event_key, team_key, point_value, threshold)")
    .eq("game_id", game.id);
  console.info("[recordEventAction][perf] cards read end", {
    durationMs: Date.now() - cardsReadStartedAt,
    cardCount: cards?.length ?? 0,
  });

  if (cardsError) {
    logTotalDuration();
    return { error: formatError(cardsError), completedAt: new Date().toISOString() };
  }

  const scoreRecomputeStartedAt = Date.now();
  const completionTransitions: Array<{ game_id: string; player_id: string; completed_at_event_id: string }> =
    [];

  for (const card of cards ?? []) {
    const playerId = typeof card.player_id === "string" ? card.player_id : null;
    const acceptedAt = typeof (card as { accepted_at?: string | null }).accepted_at === "string"
      ? (card as { accepted_at?: string | null }).accepted_at
      : null;

    if (!playerId) {
      continue;
    }

    if (!acceptedAt) {
      continue;
    }

    const progressCells: ProgressCardCell[] = normalizeCardCells(
      (card.card_cells ?? []) as Array<Partial<ProgressCardCell>>,
    );

    const beforeProgress = calculateCardProgress(
      filterRecordedEventsByAcceptedAt(recordedEventsBefore, acceptedAt),
      progressCells,
      game.completion_mode,
    );
    const afterProgress = calculateCardProgress(
      filterRecordedEventsByAcceptedAt(recordedEventsAfter, acceptedAt),
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
  console.info("[recordEventAction][perf] score recompute end", {
    durationMs: Date.now() - scoreRecomputeStartedAt,
    completionTransitions: completionTransitions.length,
  });

  if (completionTransitions.length > 0) {
    const existingCompletionsReadStartedAt = Date.now();
    console.info("[recordEventAction][perf] completion lookup start", {
      gameId: game.id,
    });
    const { data: existingCompletions, error: existingCompletionsError } = await supabase
      .from("game_completions")
      .select("player_id")
      .eq("game_id", game.id);
    console.info("[recordEventAction][perf] completion lookup end", {
      durationMs: Date.now() - existingCompletionsReadStartedAt,
      existingCount: existingCompletions?.length ?? 0,
    });

    if (existingCompletionsError) {
      logTotalDuration();
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
      const completionInsertStartedAt = Date.now();
      console.info("[recordEventAction][perf] completion insert start", {
        rowsToInsert: rowsToInsert.length,
      });
      const { error: completionInsertError } = await supabase
        .from("game_completions")
        .insert(rowsToInsert);
      console.info("[recordEventAction][perf] completion insert end", {
        durationMs: Date.now() - completionInsertStartedAt,
      });

      if (completionInsertError && completionInsertError.code !== "23505") {
        logTotalDuration();
        return { error: formatError(completionInsertError), completedAt: new Date().toISOString() };
      }
    }
  }

  const currentTime = new Date().toISOString();

  if (game.end_condition === "FIRST_COMPLETION" && completionTransitions.length > 0) {
    const finalizeStartedAt = Date.now();
    console.info("[recordEventAction][perf] finalization/winner start", {
      gameId: game.id,
      completionMode: game.completion_mode,
    });
    try {
      await finalizeGameAndSetWinner({
        supabase,
        gameId: game.id,
        completionMode: game.completion_mode,
        completedAt: currentTime,
      });
      console.info("[recordEventAction][perf] finalization/winner end", {
        durationMs: Date.now() - finalizeStartedAt,
      });
    } catch (error) {
      console.info("[recordEventAction][perf] finalization/winner end", {
        durationMs: Date.now() - finalizeStartedAt,
        failed: true,
      });
      logTotalDuration();
      return {
        error: formatError(error),
        completedAt: new Date().toISOString(),
      };
    }

    logTotalDuration();
    return {
      success: true,
      recordedEventId: inserted.id,
      completedAt: currentTime,
    };
  }

  logTotalDuration();
  return {
    success: true,
    recordedEventId: inserted.id,
    completedAt: new Date().toISOString(),
  };
}