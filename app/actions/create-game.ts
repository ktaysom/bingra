"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

export type CreateGameFormState = {
  error?: string;
};

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  hostDisplayName: z.string().min(1, "Host display name is required"),
  mode: z.enum(["quick_play", "streak"]),
  visibility: z.enum(["private", "public"]),
  allowCustomCards: z.boolean(),
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

export async function createGameAction(
  _prevState: CreateGameFormState,
  formData: FormData
): Promise<CreateGameFormState> {
  const rawTitle = formData.get("title");
  const rawHostDisplayName = formData.get("hostDisplayName");
  const rawMode = formData.get("mode") ?? "quick_play";
  const rawVisibility = formData.get("visibility") ?? "private";
  const allowCustomCardsInput = formData.get("allowCustomCards");

  const parsed = formSchema.safeParse({
    title: typeof rawTitle === "string" ? rawTitle.trim() : "",
    hostDisplayName:
      typeof rawHostDisplayName === "string" && rawHostDisplayName.trim().length > 0
        ? rawHostDisplayName.trim()
        : "Host",
    mode: typeof rawMode === "string" ? rawMode : "quick_play",
    visibility: typeof rawVisibility === "string" ? rawVisibility : "private",
    allowCustomCards: allowCustomCardsInput ? true : false,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form submission" };
  }

  const supabase = createSupabaseAdminClient();

  const rpcPayload = {
    p_title: parsed.data.title,
    p_sport: "basketball" as const,
    p_mode: parsed.data.mode,
    p_host_display_name: parsed.data.hostDisplayName,
    p_allow_custom_cards: parsed.data.allowCustomCards,
    p_visibility: parsed.data.visibility,
    p_event_keys: null,
    p_event_labels: null,
    p_event_points: null,
    p_auth_user_id: null,
  };

  console.log("rpc_create_game payload", rpcPayload);

  let hostSlug: string | null = null;

  try {
    const { data, error } = await supabase.rpc("rpc_create_game", rpcPayload);

    console.log("rpc_create_game response", { data, error });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (!rows.length) {
      throw new Error("rpc_create_game returned no rows");
    }

    const resultRow = rows[0] as {
      game_slug: string;
    };

    hostSlug = resultRow.game_slug;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("createGameAction error", error);
    return { error: formatError(error) };
  }

  if (!hostSlug) {
    return { error: "Failed to resolve game host URL" };
  }

  redirect(`/g/${hostSlug}/host`);
}