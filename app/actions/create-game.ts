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
  completion_mode: z.enum(["BLACKOUT", "STREAK"]),
  end_condition: z.enum(["FIRST_COMPLETION", "HOST_DECLARED"]),
  teamScope: z.enum(["both_teams", "team_a_only", "team_b_only"]),
  teamAName: z.string().trim().min(1, "Team A name is required"),
  teamBName: z.string().trim().min(1, "Team B name is required"),
  eventsPerCard: z.coerce.number().int().refine((value) => [6, 8, 10, 12].includes(value), {
    message: "Events per card must be one of 6, 8, 10, or 12",
  }),
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
  const rawCompletionMode = formData.get("completion_mode") ?? "BLACKOUT";
  const rawEndCondition = formData.get("end_condition") ?? "FIRST_COMPLETION";
  const rawTeamScope = formData.get("teamScope") ?? "both_teams";
  const rawTeamAName = formData.get("teamAName") ?? "Team A";
  const rawTeamBName = formData.get("teamBName") ?? "Team B";
  const rawEventsPerCard = formData.get("eventsPerCard") ?? "8";
  const rawVisibility = formData.get("visibility") ?? "private";
  const allowCustomCardsInput = formData.get("allowCustomCards");

  const parsed = formSchema.safeParse({
    title: typeof rawTitle === "string" ? rawTitle.trim() : "",
    hostDisplayName:
      typeof rawHostDisplayName === "string" && rawHostDisplayName.trim().length > 0
        ? rawHostDisplayName.trim()
        : "Host",
    mode: typeof rawMode === "string" ? rawMode : "quick_play",
    completion_mode:
      typeof rawCompletionMode === "string" ? rawCompletionMode : "BLACKOUT",
    end_condition:
      typeof rawEndCondition === "string" ? rawEndCondition : "FIRST_COMPLETION",
    teamScope: typeof rawTeamScope === "string" ? rawTeamScope : "both_teams",
    teamAName: typeof rawTeamAName === "string" ? rawTeamAName : "Team A",
    teamBName: typeof rawTeamBName === "string" ? rawTeamBName : "Team B",
    eventsPerCard: typeof rawEventsPerCard === "string" ? Number(rawEventsPerCard) : 8,
    visibility: typeof rawVisibility === "string" ? rawVisibility : "private",
    allowCustomCards: allowCustomCardsInput ? true : false,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form submission" };
  }

  const supabase = createSupabaseAdminClient();
  console.log("[createGameAction] SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

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

  console.log("[createGameAction] rpc_create_game payload", rpcPayload);

  let hostSlug: string | null = null;

  try {
    const { data, error } = await supabase.rpc("rpc_create_game", rpcPayload);

    console.log("[createGameAction] rpc_create_game response", { data, error });

    if (error) {
      console.error("[createGameAction] insert error", error);
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
    console.log("[createGameAction] resolved hostSlug", hostSlug);

    const { data: verifyRow, error: verifyError } = await supabase
      .from("games")
      .select("id, slug, title, created_at")
      .eq("slug", hostSlug)
      .maybeSingle();

    console.log("[createGameAction] immediate verify query", { verifyRow, verifyError });

    if (verifyError) {
      throw verifyError;
    }

    if (!verifyRow?.id) {
      throw new Error("Unable to resolve game configuration target");
    }

    const { error: configUpdateError } = await supabase
      .from("games")
      .update({
        completion_mode: parsed.data.completion_mode,
        end_condition: parsed.data.end_condition,
        team_a_name: parsed.data.teamAName,
        team_b_name: parsed.data.teamBName,
        team_scope: parsed.data.teamScope,
        events_per_card: parsed.data.eventsPerCard,
      })
      .eq("id", verifyRow.id)
      .limit(1);

    if (configUpdateError) {
      throw configUpdateError;
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createGameAction] error", error);
    return { error: formatError(error) };
  }

  if (!hostSlug) {
    return { error: "Failed to resolve game host URL" };
  }

  console.log("[createGameAction] redirecting to", `/g/${hostSlug}/host`);
  redirect(`/g/${hostSlug}/host`);
}