"use client";

import dynamic from "next/dynamic";

type PlayRealtimeBridgeMountProps = {
  gameId: string;
  slug: string;
};

const DISABLE_PLAY_REALTIME_BRIDGE =
  process.env.NEXT_PUBLIC_DISABLE_PLAY_REALTIME_BRIDGE === "1";

const PlayRealtimeBridge = dynamic(
  () => import("./PlayRealtimeBridge").then((module) => module.PlayRealtimeBridge),
  {
    ssr: false,
    loading: () => null,
  },
);

export function PlayRealtimeBridgeMount({ gameId, slug }: PlayRealtimeBridgeMountProps) {
  if (DISABLE_PLAY_REALTIME_BRIDGE) {
    console.info("[PlayRealtimeBridge] disabled via env", {
      gameId,
      env: "NEXT_PUBLIC_DISABLE_PLAY_REALTIME_BRIDGE=1",
    });
    return null;
  }

  return <PlayRealtimeBridge gameId={gameId} slug={slug} />;
}