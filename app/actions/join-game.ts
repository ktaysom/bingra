"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getOrCreateProfileByAuthUserId } from "../../lib/auth/profiles";

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
  const supabaseServer = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  let profileId: string | null = null;
  if (user?.id) {
    const profile = await getOrCreateProfileByAuthUserId(user.id);
    profileId = profile.id;
  }

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

    if (profileId) {
      const { data: existingLinkedPlayer, error: existingLinkedPlayerError } = await supabase
        .from("players")
        .select("id")
        .eq("game_id", game.id)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (existingLinkedPlayerError) {
        throw existingLinkedPlayerError;
      }

      if (existingLinkedPlayer?.id) {
        const cookieStore = await cookies();
        cookieStore.set({
          name: "bingra-player-id",
          value: existingLinkedPlayer.id,
          path: `/g/${parsed.data.slug}`,
          maxAge: 60 * 60 * 24 * 30,
          httpOnly: true,
          sameSite: "lax",
        });

        redirect(`/g/${parsed.data.slug}/play`);
      }
    }

    const insertPayload = {
      game_id: game.id,
      display_name: parsed.data.displayName,
      role: "player" as const,
      join_token: randomUUID(),
      profile_id: profileId,
    };

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (playerError) {
      if (profileId && (playerError as { code?: string }).code === "23505") {
        const { data: existingLinkedPlayer, error: existingLinkedPlayerError } = await supabase
          .from("players")
          .select("id")
          .eq("game_id", game.id)
          .eq("profile_id", profileId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle<{ id: string }>();

        if (existingLinkedPlayerError) {
          throw existingLinkedPlayerError;
        }

        if (existingLinkedPlayer?.id) {
          const cookieStore = await cookies();
          cookieStore.set({
            name: "bingra-player-id",
            value: existingLinkedPlayer.id,
            path: `/g/${parsed.data.slug}`,
            maxAge: 60 * 60 * 24 * 30,
            httpOnly: true,
            sameSite: "lax",
          });

          redirect(`/g/${parsed.data.slug}/play`);
        }
      }

      throw playerError;
    }

    if (!playerData) {
      throw new Error("Failed to create player record");
    }

    const cookieOptions = {
      name: "bingra-player-id",
      value: playerData.id,
      path: `/g/${parsed.data.slug}`,
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax" as const,
    };

    const cookieStore = await cookies();
    cookieStore.set(cookieOptions);

    redirect(`/g/${parsed.data.slug}/play`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[joinGameAction] error", error);
    return { error: formatError(error) };
  }
}