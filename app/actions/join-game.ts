"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type JoinGameFormState = {
  error?: string;
};

const formSchema = z.object({
  slug: z.string().min(1, "Missing game identifier"),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required"),
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

export async function joinGameAction(
  _prevState: JoinGameFormState,
  formData: FormData
): Promise<JoinGameFormState> {
  const rawSlug = formData.get("slug");
  const rawDisplayName = formData.get("displayName");

  const parsed = formSchema.safeParse({
    slug: typeof rawSlug === "string" ? rawSlug.trim() : "",
    displayName:
      typeof rawDisplayName === "string" ? rawDisplayName.trim() : "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form submission" };
  }

  const supabase = createSupabaseAdminClient();

  try {
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", parsed.data.slug)
      .maybeSingle<{ id: string }>();

    if (gameError) {
      throw gameError;
    }

    if (!game) {
      return { error: "Game not found" };
    }

    const insertPayload = {
      game_id: game.id,
      display_name: parsed.data.displayName,
      role: "player" as const,
      join_token: randomUUID(),
    };

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (playerError) {
      throw playerError;
    }

    if (!playerData) {
      throw new Error("Failed to create player record");
    }

    redirect(`/g/${parsed.data.slug}/play`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[joinGameAction] error", error);
    return { error: formatError(error) };
  }
}