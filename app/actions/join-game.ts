"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  resolveCanonicalAccountIdForAuthUserId,
  resolveProfileDefaultDisplayName,
} from "../../lib/auth/profiles";
import { ensurePlayerLinkedToAuthenticatedUser } from "../../lib/auth/link-player";
import {
  generatePlayerRecoveryToken,
  getPlayerRecoveryTokenCookieName,
  hashPlayerRecoveryToken,
} from "../../lib/auth/player-recovery";

export type JoinGameFormState = {
  error?: string;
};

const formSchema = z.object({
  slug: z.string().min(1, "Missing game identifier"),
  displayName: z.string().optional(),
});

const JOIN_PROMPT_COOKIE_NAME = "bingra-join-prompt-token";

type JoinStepContext = {
  step: string;
  client: "admin" | "server" | "next_cookies" | "internal";
  operation: string;
};

function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /ECONNRESET|fetch failed|ETIMEDOUT|socket hang up|network/i.test(message);
}

async function runJoinStep<T>(context: JoinStepContext, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    throw error;
  }
}

async function runJoinStepWithSingleRetry<T>(context: JoinStepContext, action: () => Promise<T>): Promise<T> {
  try {
    return await runJoinStep(context, action);
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    return runJoinStep(
      {
        ...context,
        step: `${context.step}:retry1`,
      },
      action,
    );
  }
}

async function redirectWithJoinPrompt(slug: string) {
  const token = randomUUID();
  const cookieStore = await cookies();

  cookieStore.set({
    name: JOIN_PROMPT_COOKIE_NAME,
    value: token,
    path: `/g/${slug}/play`,
    maxAge: 60 * 15,
    httpOnly: true,
    sameSite: "lax",
  });

  redirect(`/g/${slug}/play?joined=1&jt=${encodeURIComponent(token)}`);
}

async function issueOrRotatePlayerRecoveryToken(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  slug: string;
  playerId: string;
  mode: "issued" | "rotated";
}) {
  const recoveryToken = generatePlayerRecoveryToken();
  const recoveryTokenHash = hashPlayerRecoveryToken(recoveryToken);

  const { error } = await params.supabase
    .from("players")
    .update({ recovery_token_hash: recoveryTokenHash })
    .eq("id", params.playerId)
    .limit(1);

  if (error) {
    throw error;
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getPlayerRecoveryTokenCookieName(params.slug),
    value: recoveryToken,
    path: `/g/${params.slug}`,
    maxAge: 60 * 15,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  console.log(`[auth] player recovery token ${params.mode}`, {
    slug: params.slug,
    playerId: params.playerId,
  });
}

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

function formatErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      type: "Error",
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        "cause" in error
          ? (() => {
              try {
                return JSON.stringify((error as Error & { cause?: unknown }).cause);
              } catch {
                return String((error as Error & { cause?: unknown }).cause);
              }
            })()
          : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return {
        type: "object",
        json: JSON.stringify(error),
      };
    } catch {
      return {
        type: "object",
        value: String(error),
      };
    }
  }

  return {
    type: typeof error,
    value: String(error),
  };
}

export async function joinGameAction(
  _prevState: JoinGameFormState,
  formData: FormData
): Promise<JoinGameFormState> {
  const actionStartedAt = Date.now();

  const rawSlug = formData.get("slug");
  const rawDisplayName = formData.get("displayName");

  const parsed = formSchema.safeParse({
    slug: typeof rawSlug === "string" ? rawSlug.trim() : "",
    displayName: typeof rawDisplayName === "string" ? rawDisplayName.trim() : "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form submission" };
  }

  const supabase = await runJoinStep(
    {
      step: "create-admin-client",
      client: "admin",
      operation: "createSupabaseAdminClient",
    },
    async () => createSupabaseAdminClient(),
  );
  const supabaseServer = await runJoinStep(
    {
      step: "create-server-client",
      client: "server",
      operation: "createSupabaseServerClient",
    },
    async () => createSupabaseServerClient(),
  );

  const {
    data: { user },
  } = await runJoinStep(
    {
      step: "auth-get-user",
      client: "server",
      operation: "auth.getUser",
    },
    async () => supabaseServer.auth.getUser(),
  );

  let profileId: string | null = null;
  let resolvedAuthenticatedDisplayName: string | null = null;
  if (user?.id) {
    // Compatibility-phase canonical write identity:
    // players.profile_id now stores canonical accounts.id for new authenticated writes.
    profileId = await runJoinStep(
      {
        step: "resolve-canonical-account-id",
        client: "internal",
        operation: "resolveCanonicalAccountIdForAuthUserId",
      },
      async () => resolveCanonicalAccountIdForAuthUserId(user.id),
    );
    resolvedAuthenticatedDisplayName = await runJoinStep(
      {
        step: "resolve-profile-default-display-name",
        client: "internal",
        operation: "resolveProfileDefaultDisplayName",
      },
      async () => resolveProfileDefaultDisplayName(user.id),
    );
  }

  const submittedDisplayName = parsed.data.displayName?.trim() ?? "";
  const playerDisplayName = profileId
    ? (submittedDisplayName || resolvedAuthenticatedDisplayName || "")
    : submittedDisplayName;

  if (!playerDisplayName) {
    return { error: "Display name is required" };
  }

  try {
    const { data: game, error: gameError } = await runJoinStep(
      {
        step: "lookup-game-by-slug",
        client: "admin",
        operation: "from(games).select(id).eq(slug).maybeSingle",
      },
      async () =>
        supabase
          .from("games")
          .select("id")
          .eq("slug", parsed.data.slug)
          .maybeSingle<{ id: string }>(),
    );

    await runJoinStep(
      {
        step: "post-lookup-check-game-error",
        client: "internal",
        operation: "throw when lookup returned error object",
      },
      async () => {
        if (gameError) {
          throw gameError;
        }
      },
    );

    const gameFound = await runJoinStep(
      {
        step: "post-lookup-check-game-found",
        client: "internal",
        operation: "verify lookup returned game row",
      },
      async () => Boolean(game),
    );

    if (!gameFound) {
      return { error: "Game not found" };
    }

    const cookiePlayerId = await runJoinStep(
      {
        step: "read-cookie-player-id",
        client: "next_cookies",
        operation: "cookies().get(bingra-player-id)",
      },
      async () => (await cookies()).get("bingra-player-id")?.value ?? null,
    );

    if (profileId && user?.id && cookiePlayerId) {
      const { data: cookiePlayer, error: cookiePlayerError } = await runJoinStep(
        {
          step: "lookup-cookie-player",
          client: "admin",
          operation: "from(players).select(id,game_id).eq(id).maybeSingle",
        },
        async () =>
          supabase
            .from("players")
            .select("id, game_id")
            .eq("id", cookiePlayerId)
            .maybeSingle<{ id: string; game_id: string }>(),
      );

      if (cookiePlayerError) {
        throw cookiePlayerError;
      }

      if (cookiePlayer?.id && cookiePlayer.game_id === game.id) {
        await runJoinStep(
          {
            step: "rotate-recovery-token-cookie-player",
            client: "admin",
            operation: "issueOrRotatePlayerRecoveryToken(rotated)",
          },
          async () =>
            issueOrRotatePlayerRecoveryToken({
              supabase,
              slug: parsed.data.slug,
              playerId: cookiePlayer.id,
              mode: "rotated",
            }),
        );

        await runJoinStep(
          {
            step: "ensure-cookie-player-linked",
            client: "internal",
            operation: "ensurePlayerLinkedToAuthenticatedUser",
          },
          async () =>
            ensurePlayerLinkedToAuthenticatedUser({
              playerId: cookiePlayer.id,
              authUserId: user.id,
              context: "join-game/cookie-player",
            }),
        );

        await runJoinStep(
          {
            step: "redirect-with-join-prompt-cookie-player",
            client: "next_cookies",
            operation: "redirectWithJoinPrompt",
          },
          async () => redirectWithJoinPrompt(parsed.data.slug),
        );
      }
    }

    if (profileId) {
      const { data: existingLinkedPlayer, error: existingLinkedPlayerError } = await runJoinStep(
        {
          step: "lookup-existing-linked-player",
          client: "admin",
          operation: "from(players).select(id).eq(game_id,profile_id).maybeSingle",
        },
        async () =>
          supabase
            .from("players")
            .select("id")
            .eq("game_id", game.id)
            .eq("profile_id", profileId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle<{ id: string }>(),
      );

      if (existingLinkedPlayerError) {
        throw existingLinkedPlayerError;
      }

      if (existingLinkedPlayer?.id) {
        await runJoinStep(
          {
            step: "rotate-recovery-token-existing-linked-player",
            client: "admin",
            operation: "issueOrRotatePlayerRecoveryToken(rotated)",
          },
          async () =>
            issueOrRotatePlayerRecoveryToken({
              supabase,
              slug: parsed.data.slug,
              playerId: existingLinkedPlayer.id,
              mode: "rotated",
            }),
        );

        await runJoinStep(
          {
            step: "set-cookie-existing-linked-player",
            client: "next_cookies",
            operation: "cookies().set(bingra-player-id)",
          },
          async () => {
            const cookieStore = await cookies();
            console.log("[auth] setting bingra-player-id cookie", {
              maxAge: 60 * 60 * 24 * 365 * 2,
            });
            cookieStore.set({
              name: "bingra-player-id",
              value: existingLinkedPlayer.id,
              path: "/",
              maxAge: 60 * 60 * 24 * 365 * 2,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          },
        );

        await runJoinStep(
          {
            step: "redirect-with-join-prompt-existing-linked-player",
            client: "next_cookies",
            operation: "redirectWithJoinPrompt",
          },
          async () => redirectWithJoinPrompt(parsed.data.slug),
        );
      }
    }

    const insertPayload = {
      game_id: game.id,
      display_name: playerDisplayName,
      role: "player" as const,
      join_token: randomUUID(),
      profile_id: profileId,
    };

    const { data: playerData, error: playerError } = await runJoinStepWithSingleRetry(
      {
        step: "insert-player",
        client: "admin",
        operation: "from(players).insert(...).select(id).maybeSingle",
      },
      async () =>
        supabase
          .from("players")
          .insert(insertPayload)
          .select("id")
          .maybeSingle(),
    );

    if (playerError) {
      if (profileId && (playerError as { code?: string }).code === "23505") {
        const { data: existingLinkedPlayer, error: existingLinkedPlayerError } = await runJoinStep(
          {
            step: "lookup-existing-linked-player-after-23505",
            client: "admin",
            operation: "from(players).select(id).eq(game_id,profile_id).maybeSingle",
          },
          async () =>
            supabase
              .from("players")
              .select("id")
              .eq("game_id", game.id)
              .eq("profile_id", profileId)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle<{ id: string }>(),
        );

        if (existingLinkedPlayerError) {
          throw existingLinkedPlayerError;
        }

        if (existingLinkedPlayer?.id) {
          await runJoinStep(
            {
              step: "rotate-recovery-token-existing-linked-player-after-23505",
              client: "admin",
              operation: "issueOrRotatePlayerRecoveryToken(rotated)",
            },
            async () =>
              issueOrRotatePlayerRecoveryToken({
                supabase,
                slug: parsed.data.slug,
                playerId: existingLinkedPlayer.id,
                mode: "rotated",
              }),
          );

          await runJoinStep(
            {
              step: "set-cookie-existing-linked-player",
              client: "next_cookies",
              operation: "cookies().set(bingra-player-id)",
            },
            async () => {
              const cookieStore = await cookies();
              console.log("[auth] setting bingra-player-id cookie", {
                maxAge: 60 * 60 * 24 * 365 * 2,
              });
              cookieStore.set({
                name: "bingra-player-id",
                value: existingLinkedPlayer.id,
                path: "/",
                maxAge: 60 * 60 * 24 * 365 * 2,
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
              });
            },
          );

          await runJoinStep(
            {
              step: "redirect-with-join-prompt-existing-linked-player",
              client: "next_cookies",
              operation: "redirectWithJoinPrompt",
            },
            async () => redirectWithJoinPrompt(parsed.data.slug),
          );
        }
      }

      throw playerError;
    }

    if (!playerData) {
      throw new Error("Failed to create player record");
    }

    await runJoinStep(
      {
        step: "issue-recovery-token-inserted-player",
        client: "admin",
        operation: "issueOrRotatePlayerRecoveryToken(issued)",
      },
      async () =>
        issueOrRotatePlayerRecoveryToken({
          supabase,
          slug: parsed.data.slug,
          playerId: playerData.id,
          mode: "issued",
        }),
    );

    const cookieOptions = {
      name: "bingra-player-id",
      value: playerData.id,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };

    await runJoinStep(
      {
        step: "set-cookie-inserted-player",
        client: "next_cookies",
        operation: "cookies().set(bingra-player-id)",
      },
      async () => {
        const cookieStore = await cookies();
        console.log("[auth] setting bingra-player-id cookie", {
          maxAge: 60 * 60 * 24 * 365 * 2,
        });
        cookieStore.set(cookieOptions);
      },
    );

    await runJoinStep(
      {
        step: "redirect-with-join-prompt-inserted-player",
        client: "next_cookies",
        operation: "redirectWithJoinPrompt",
      },
      async () => redirectWithJoinPrompt(parsed.data.slug),
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[joinGameAction] error", {
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - actionStartedAt,
      error: formatErrorForLog(error),
    });
    return { error: formatError(error) };
  } finally {
    console.info("[joinGameAction][perf] total action duration", {
      durationMs: Date.now() - actionStartedAt,
    });
  }
}