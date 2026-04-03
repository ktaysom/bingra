import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { hashPlayerRecoveryToken } from "../../../../lib/auth/player-recovery";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

type RecoverPlayerRequestBody = {
  recoveryToken?: string;
};

type GameRecord = {
  id: string;
};

type PlayerRecord = {
  id: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  let body: RecoverPlayerRequestBody;
  try {
    body = (await request.json()) as RecoverPlayerRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const recoveryToken = typeof body.recoveryToken === "string" ? body.recoveryToken.trim() : "";
  if (!slug || !recoveryToken) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const recoveryTokenHash = hashPlayerRecoveryToken(recoveryToken);

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  if (gameError || !game?.id) {
    console.warn("[auth] player recovery failed (game not found)", {
      slug,
    });
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", game.id)
    .eq("recovery_token_hash", recoveryTokenHash)
    .limit(1)
    .maybeSingle<PlayerRecord>();

  if (playerError || !player?.id) {
    console.warn("[auth] player recovery failed (token mismatch)", {
      slug,
    });
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    playerId: player.id,
    slug,
  });

  response.cookies.set({
    name: "bingra-player-id",
    value: player.id,
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  console.log("[auth] player recovery succeeded", {
    slug,
    playerId: player.id,
  });

  return response;
}

export function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
