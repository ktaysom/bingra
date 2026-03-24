"use server";

import { randomUUID } from "crypto";
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
  const actionStartedAt = Date.now();
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

  console.info("[createGameAction][perf] action start", {
    startedAt: new Date(actionStartedAt).toISOString(),
    hasTitle: typeof rawTitle === "string" ? rawTitle.trim().length > 0 : false,
  });

  try {

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

    let profileId: string | null = null;
    let resolvedHostDisplayName = parsed.data.hostDisplayName;
    if (user?.id) {
      // Compatibility-phase canonical write identity:
      // players.profile_id uses canonical accounts.id for new authenticated writes.
      profileId = await resolveCanonicalAccountIdForAuthUserId(user.id);

      if (!resolvedHostDisplayName.trim() || resolvedHostDisplayName.trim().toLowerCase() === "host") {
        resolvedHostDisplayName = await resolveProfileDefaultDisplayName(user.id);
      }
    }

    console.log("[createGameAction] SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

    const selectedSport = resolveCreateGameSport(parsed.data.sport_profile);

    const rpcPayload = {
      p_title: parsed.data.title,
      p_sport: selectedSport,
      p_mode: parsed.data.mode,
      p_host_display_name: resolvedHostDisplayName,
      p_allow_custom_cards: parsed.data.allowCustomCards,
      p_visibility: parsed.data.visibility,
      p_event_keys: null,
      p_event_labels: null,
      p_event_points: null,
      p_auth_user_id: user?.id ?? null,
    };

    console.log("[createGameAction] rpc_create_game payload", rpcPayload);

    let hostSlug: string | null = null;
    let hostPlayerId: string | null = null;

    try {
      const rpcStartedAt = Date.now();
      console.info("[createGameAction][perf] rpc_create_game start");
      const { data, error } = await supabase.rpc("rpc_create_game", rpcPayload);
      console.info("[createGameAction][perf] rpc_create_game end", {
        durationMs: Date.now() - rpcStartedAt,
      });

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

      const verifyGameStartedAt = Date.now();
      console.info("[createGameAction][perf] games verify query start", { hostSlug });
      const { data: verifyRow, error: verifyError } = await supabase
        .from("games")
        .select("id, slug, title, created_at")
        .eq("slug", hostSlug)
        .maybeSingle();
      console.info("[createGameAction][perf] games verify query end", {
        durationMs: Date.now() - verifyGameStartedAt,
      });

      console.log("[createGameAction] immediate verify query", { verifyRow, verifyError });

      if (verifyError) {
        throw verifyError;
      }

      if (!verifyRow?.id) {
        throw new Error("Unable to resolve game configuration target");
      }

      const configUpdateStartedAt = Date.now();
      console.info("[createGameAction][perf] games config update start", {
        gameId: verifyRow.id,
      });
      const { error: configUpdateError } = await supabase
        .from("games")
        .update({
          completion_mode: parsed.data.completion_mode,
          end_condition: parsed.data.end_condition,
          team_a_name: parsed.data.teamAName,
          team_b_name: parsed.data.teamBName,
          team_scope: parsed.data.teamScope,
          events_per_card: parsed.data.eventsPerCard,
          sport_profile: parsed.data.sport_profile,
          catalog_version: "v1",
          ...(user?.id ? { auth_user_id: user.id } : {}),
          ...(profileId ? { account_id: profileId } : {}),
        })
        .eq("id", verifyRow.id)
        .limit(1);
      console.info("[createGameAction][perf] games config update end", {
        durationMs: Date.now() - configUpdateStartedAt,
      });

      if (configUpdateError) {
        throw configUpdateError;
      }

      const hostPlayerLookupStartedAt = Date.now();
      console.info("[createGameAction][perf] host player check start", {
        gameId: verifyRow.id,
      });
      const { data: existingHostPlayer, error: hostPlayerLookupError } = await supabase
        .from("players")
        .select("id, profile_id")
        .eq("game_id", verifyRow.id)
        .eq("role", "host")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string; profile_id: string | null }>();
      console.info("[createGameAction][perf] host player check end", {
        durationMs: Date.now() - hostPlayerLookupStartedAt,
        foundExistingHost: Boolean(existingHostPlayer?.id),
      });

      if (hostPlayerLookupError) {
        throw hostPlayerLookupError;
      }

      if (existingHostPlayer?.id) {
        if (profileId && !existingHostPlayer.profile_id) {
          const { error: hostBackfillError } = await supabase
            .from("players")
            .update({ profile_id: profileId })
            .eq("id", existingHostPlayer.id)
            .is("profile_id", null)
            .limit(1);

          if (hostBackfillError) {
            throw hostBackfillError;
          }
        }

        hostPlayerId = existingHostPlayer.id;
      } else {
        const hostPlayerCreateStartedAt = Date.now();
        console.info("[createGameAction][perf] host player create start", {
          gameId: verifyRow.id,
        });
        const { data: insertedHostPlayer, error: insertHostPlayerError } = await supabase
          .from("players")
          .insert({
            game_id: verifyRow.id,
            display_name: resolvedHostDisplayName,
            role: "host",
            join_token: randomUUID(),
            profile_id: profileId,
          })
          .select("id")
          .maybeSingle<{ id: string }>();
        console.info("[createGameAction][perf] host player create end", {
          durationMs: Date.now() - hostPlayerCreateStartedAt,
          insertedHostPlayerId: insertedHostPlayer?.id ?? null,
        });

        if (insertHostPlayerError) {
          throw insertHostPlayerError;
        }

        hostPlayerId = insertedHostPlayer?.id ?? null;
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

    if (!hostPlayerId) {
      return { error: "Failed to initialize host player session" };
    }

    console.info("[createGameAction][perf] cookie set + redirect", {
      hostSlug,
      hasHostPlayerId: Boolean(hostPlayerId),
    });
    const cookieStore = await cookies();
    cookieStore.set({
      name: "bingra-player-id",
      value: hostPlayerId,
      path: `/g/${hostSlug}`,
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
    });

    console.log("[createGameAction] redirecting to", `/g/${hostSlug}/play`);
    redirect(`/g/${hostSlug}/play`);
  } finally {
    console.info("[createGameAction][perf] total action duration", {
      durationMs: Date.now() - actionStartedAt,
    });
  }
}