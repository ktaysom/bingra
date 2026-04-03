"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import {
  clearPlayerRecoveryHandoffCookie,
  readPlayerRecoveryHandoffCookie,
  removeStalePlayerRecoveryFromStorage,
  savePlayerRecoveryToStorage,
} from "../../../../lib/bingra/player-recovery-storage";

type PlayRealtimeBridgeMountProps = {
  gameId: string;
  slug: string;
  playerId: string;
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

export function PlayRealtimeBridgeMount({ gameId, slug, playerId }: PlayRealtimeBridgeMountProps) {
  useEffect(() => {
    removeStalePlayerRecoveryFromStorage(slug);

    const handoffToken = readPlayerRecoveryHandoffCookie(slug);
    if (!handoffToken) {
      return;
    }

    console.info("[auth][recovery] handoff cookie found", {
      slug,
      hasPlayerId: Boolean(playerId),
    });

    savePlayerRecoveryToStorage({
      slug,
      recoveryToken: handoffToken,
      playerId,
    });

    console.info("[auth][recovery] token persisted to localStorage", {
      slug,
      hasPlayerId: Boolean(playerId),
    });

    clearPlayerRecoveryHandoffCookie(slug);
    console.info("[auth][recovery] handoff cookie cleared", {
      slug,
    });
  }, [playerId, slug]);

  if (DISABLE_PLAY_REALTIME_BRIDGE) {
    console.info("[PlayRealtimeBridge] disabled via env", {
      gameId,
      env: "NEXT_PUBLIC_DISABLE_PLAY_REALTIME_BRIDGE=1",
    });
    return null;
  }

  return <PlayRealtimeBridge gameId={gameId} slug={slug} />;
}