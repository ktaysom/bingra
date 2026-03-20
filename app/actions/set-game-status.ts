"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type SetGameStatusFormState = {
  success?: boolean;
  error?: string;
  completedAt?: string;
  status?: "lobby" | "live" | "finished";
};

const setGameStatusSchema = z.object({
  slug: z.string().min(1, "Missing game slug"),
  intent: z.enum(["start", "end"]),
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

export async function setGameStatusAction(
  _prevState: SetGameStatusFormState,
  formData: FormData,
): Promise<SetGameStatusFormState> {
  const parsed = setGameStatusSchema.safeParse({
    slug: typeof formData.get("slug") === "string" ? formData.get("slug") : "",
    intent: formData.get("intent"),
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
    .select("id, status")
    .eq("slug", parsed.data.slug)
    .maybeSingle<{ id: string; status: "lobby" | "live" | "finished" }>();

  if (gameError) {
    return { error: formatError(gameError), completedAt: new Date().toISOString() };
  }

  if (!game) {
    return { error: "Game not found", completedAt: new Date().toISOString() };
  }

  const nextStatus = parsed.data.intent === "start" ? "live" : "finished";

  if (parsed.data.intent === "start" && game.status !== "lobby") {
    return {
      error: "Only lobby games can be started.",
      completedAt: new Date().toISOString(),
      status: game.status,
    };
  }

  if (parsed.data.intent === "end" && game.status !== "live") {
    return {
      error: "Only live games can be ended.",
      completedAt: new Date().toISOString(),
      status: game.status,
    };
  }

  const now = new Date().toISOString();
  const updatePayload: {
    status: "live" | "finished";
    completed_at?: string | null;
  } = {
    status: nextStatus,
    completed_at: parsed.data.intent === "end" ? now : null,
  };

  const { error: updateError } = await supabase
    .from("games")
    .update(updatePayload)
    .eq("id", game.id)
    .eq("status", game.status)
    .limit(1);

  if (updateError) {
    return {
      error: formatError(updateError),
      completedAt: now,
      status: game.status,
    };
  }

  return {
    success: true,
    completedAt: now,
    status: nextStatus,
  };
}