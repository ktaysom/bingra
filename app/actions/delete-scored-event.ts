"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type DeleteScoredEventFormState = {
  success?: boolean;
  removedEventId?: string;
  completedAt?: string;
  error?: string;
};

const deleteScoredEventSchema = z.object({
  slug: z.string().min(1, "Missing game slug"),
  recordedEventId: z.string().min(1, "Missing scored event id"),
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

export async function deleteScoredEventAction(
    _prevState: DeleteScoredEventFormState,
  formData: FormData
): Promise<DeleteScoredEventFormState> {
  const slugValue = formData.get("slug");
  const recordedEventIdValue = formData.get("recordedEventId");

  const parsed = deleteScoredEventSchema.safeParse({
    slug: typeof slugValue === "string" ? slugValue.trim() : "",
    recordedEventId:
      typeof recordedEventIdValue === "string" ? recordedEventIdValue.trim() : "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      completedAt: new Date().toISOString(),
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle<{ id: string }>();

  if (gameError) {
    return { error: formatError(gameError), completedAt: new Date().toISOString() };
  }

  if (!game) {
    return {
      error: "Game not found",
      completedAt: new Date().toISOString(),
    };
  }

  const { data: scoredEvent, error: scoredEventError } = await supabase
    .from("scored_events")
    .select("id, game_id")
    .eq("id", parsed.data.recordedEventId)
    .maybeSingle<{ id: string; game_id: string }>();

  if (scoredEventError) {
    return {
      error: formatError(scoredEventError),
      completedAt: new Date().toISOString(),
    };
  }

  if (!scoredEvent || scoredEvent.game_id !== game.id) {
    return {
      error: "Scored event not associated with this game",
      completedAt: new Date().toISOString(),
    };
  }

  const { error: deleteError } = await supabase
    .from("scored_events")
    .delete()
    .eq("id", parsed.data.recordedEventId)
    .limit(1);

  if (deleteError) {
    return {
      error: formatError(deleteError),
      completedAt: new Date().toISOString(),
    };
  }

  return {
    success: true,
    removedEventId: parsed.data.recordedEventId,
    completedAt: new Date().toISOString(),
  };
}