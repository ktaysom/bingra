"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  resolveCanonicalAccountIdForAuthUserId,
  resolveProfileDefaultDisplayName,
} from "../../lib/auth/profiles";
import {
  DEFAULT_SPORT_PROFILE,
  SPORT_PROFILES,
  type SportProfileKey,
} from "../../lib/bingra/sport-profiles";
import { resolveCreateGameSport } from "../../lib/bingra/create-game-payload";

export type CreateGameFormState = {
  error?: string;
};

const AUTH_REQUIRED_CREATE_ERROR = "Please sign in to create a game.";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  hostDisplayName: z.string().min(1, "Host display name is required"),
  mode: z.enum(["quick_play", "streak"]),
  completion_mode: z.enum(["BLACKOUT", "STREAK"]),
  end_condition: z.enum(["FIRST_COMPLETION", "HOST_DECLARED"]),
  teamScope: z.enum(["both_teams", "team_a_only", "team_b_only"]),
  teamAName: z.string().trim().min(1, "Team A name is required"),
  teamBName: z.string().trim().min(1, "Team B name is required"),
  eventsPerCard: z.coerce.number().int().min(3).max(15),
  visibility: z.enum(["private", "public"]),
  allowCustomCards: z.boolean(),
  sport_profile: z.custom<SportProfileKey>((value) =>
    typeof value === "string" &&
    SPORT_PROFILES.some((profile) => profile.key === value),
  ),
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
  const rawSportProfile = formData.get("sport_profile") ?? DEFAULT_SPORT_PROFILE;

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
    sport_profile:
      typeof rawSportProfile === "string" ? rawSportProfile : DEFAULT_SPORT_PROFILE,
  });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid form submission" };
    }

    const supabase = createSupabaseAdminClient();
    const supabaseServer = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user?.id) {
      return { error: AUTH_REQUIRED_CREATE_ERROR };
    }

    // Canonical write identity for host ownership.
    const profileId = await resolveCanonicalAccountIdForAuthUserId(user.id);
    let resolvedHostDisplayName = parsed.data.hostDisplayName;

    if (!resolvedHostDisplayName.trim() || resolvedHostDisplayName.trim().toLowerCase() === "host") {
      resolvedHostDisplayName = await resolveProfileDefaultDisplayName(user.id);
    }

    const selectedSport = resolveCreateGameSport(parsed.data.sport_profile);

    const rpcPayload = {
      p_title: parsed.data.title,
      p_sport: selectedSport,
      p_mode: parsed.data.mode,
      p_host_display_name: resolvedHostDisplayName,
      p_allow_custom_cards: parsed.data.allowCustomCards,
      p_visibility: parsed.data.visibility,
      p_completion_mode: parsed.data.completion_mode,
      p_end_condition: parsed.data.end_condition,
      p_team_a_name: parsed.data.teamAName,
      p_team_b_name: parsed.data.teamBName,
      p_team_scope: parsed.data.teamScope,
      p_events_per_card: parsed.data.eventsPerCard,
      p_sport_profile: parsed.data.sport_profile,
      p_catalog_version: "v1",
      p_auth_user_id: user.id,
      p_account_id: profileId,
    };

    let hostSlug: string | null = null;
    let hostPlayerId: string | null = null;

    try {
      const { data, error } = await supabase.rpc("rpc_create_game_full", rpcPayload);

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
        host_player_id: string | null;
      };

      hostSlug = resultRow.game_slug;
      hostPlayerId = resultRow.host_player_id;
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

    if (!hostPlayerId) {
      return { error: "Failed to initialize host player session" };
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: "bingra-player-id",
      value: hostPlayerId,
      path: `/g/${hostSlug}`,
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
    });
    redirect(`/g/${hostSlug}/play`);
}