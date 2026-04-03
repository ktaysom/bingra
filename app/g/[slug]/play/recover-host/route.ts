import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import {
  resolveCanonicalAccountIdForAuthUserId,
  resolveProfileDefaultDisplayName,
} from "../../../../../lib/auth/profiles";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

type GameAuthorityRecord = {
  id: string;
  slug: string;
  host_account_id: string | null;
  restricted_scoring: boolean;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = createSupabaseAdminClient();
  const supabaseServer = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user?.id) {
    return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
  }

  const actorAccountId = await resolveCanonicalAccountIdForAuthUserId(user.id);

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, slug, host_account_id, restricted_scoring")
    .eq("slug", slug)
    .maybeSingle<GameAuthorityRecord>();

  if (gameError || !game) {
    return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
  }

  if (
    !game.restricted_scoring ||
    !game.host_account_id ||
    actorAccountId !== game.host_account_id
  ) {
    return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
  }

  const { data: existingHostPlayer, error: existingHostPlayerError } = await supabase
    .from("players")
    .select("id, profile_id")
    .eq("game_id", game.id)
    .eq("role", "host")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; profile_id: string | null }>();

  if (existingHostPlayerError) {
    console.error("[play/recover-host] host lookup failed", {
      slug,
      userId: user.id,
      error: existingHostPlayerError,
    });
    return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
  }

  let resolvedHostPlayerId: string | null = existingHostPlayer?.id ?? null;

  if (existingHostPlayer?.id) {
    if (!existingHostPlayer.profile_id) {
      await supabase
        .from("players")
        .update({ profile_id: actorAccountId })
        .eq("id", existingHostPlayer.id)
        .is("profile_id", null)
        .limit(1);
    }
  } else {
    const hostDisplayName = await resolveProfileDefaultDisplayName(user.id);
    const { data: insertedHostPlayer, error: insertedHostPlayerError } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        display_name: hostDisplayName,
        role: "host",
        join_token: randomUUID(),
        profile_id: actorAccountId,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertedHostPlayerError || !insertedHostPlayer?.id) {
      console.error("[play/recover-host] host create failed", {
        slug,
        userId: user.id,
        error: insertedHostPlayerError,
      });
      return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
    }

    resolvedHostPlayerId = insertedHostPlayer.id;
  }

  if (!resolvedHostPlayerId) {
    return NextResponse.redirect(new URL(`/g/${slug}`, request.url));
  }

  const response = NextResponse.redirect(new URL(`/g/${slug}/play`, request.url));
  console.log("[auth] setting bingra-player-id cookie", {
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  response.cookies.set({
    name: "bingra-player-id",
    value: resolvedHostPlayerId,
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
