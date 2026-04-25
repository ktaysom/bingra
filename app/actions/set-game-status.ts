"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { finalizeGameAndSetWinner } from "../../lib/bingra/finalize-game";
import { assertHostAuthorized } from "../../lib/auth/host-authorization";

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
  const startedAt = Date.now();
  const logTiming = (segment: string, segmentStartedAt: number, extra?: Record<string, unknown>) => {
    console.info("[setGameStatusAction][timing]", {
      segment,
      durationMs: Date.now() - segmentStartedAt,
      totalDurationMs: Date.now() - startedAt,
      ...(extra ?? {}),
    });
  };

  const parsed = setGameStatusSchema.safeParse({
    slug: typeof formData.get("slug") === "string" ? formData.get("slug") : "",
    intent: formData.get("intent"),
  });

  if (!parsed.success) {
    logTiming("validation-failed", startedAt, {
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    });
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      completedAt: new Date().toISOString(),
    };
  }

  try {
    const hostAuthStartedAt = Date.now();
    const authorization = await assertHostAuthorized(parsed.data.slug);
    logTiming("host-authorization", hostAuthStartedAt, {
      slug: parsed.data.slug,
      intent: parsed.data.intent,
      status: authorization.status,
    });
    const game = {
      id: authorization.gameId,
      status: authorization.status,
      completionMode: authorization.completionMode,
    };

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

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (parsed.data.intent === "end") {
      try {
        const finalizeStartedAt = Date.now();
        const finalized = await finalizeGameAndSetWinner({
          supabase,
          gameId: game.id,
          completionMode: game.completionMode,
          completedAt: now,
        });
        logTiming("finalize-game", finalizeStartedAt, {
          status: "finished",
        });

        return {
          success: true,
          completedAt: finalized.completedAt,
          status: "finished",
        };
      } catch (error) {
        return {
          error: formatError(error),
          completedAt: now,
          status: game.status,
        };
      }
    }

    const updatePayload: {
      status: "live" | "finished";
      completed_at?: string | null;
      winner_player_id?: string | null;
    } = {
      status: nextStatus,
      completed_at: null,
      winner_player_id: null,
    };

    const updateStartedAt = Date.now();
    const { error: updateError } = await supabase
      .from("games")
      .update(updatePayload)
      .eq("id", game.id)
      .eq("status", game.status)
      .limit(1);
    logTiming("game-status-update", updateStartedAt, {
      nextStatus,
      hasError: Boolean(updateError),
    });

    if (updateError) {
      return {
        error: formatError(updateError),
        completedAt: now,
        status: game.status,
      };
    }

    logTiming("action-complete", startedAt, {
      success: true,
      status: nextStatus,
    });
    return {
      success: true,
      completedAt: now,
      status: nextStatus,
    };
  } catch (error) {
    return {
      error: formatError(error),
      completedAt: new Date().toISOString(),
    };
  }
}
