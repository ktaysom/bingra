"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";

type PlayRealtimeBridgeProps = {
  gameId: string;
};

export function PlayRealtimeBridge({ gameId }: PlayRealtimeBridgeProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channelName = `play-live-${gameId}`;

    console.info("[PlayRealtimeBridge] mount", { gameId });

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = (payload: {
      source: string;
      eventType?: string;
      table?: string;
      schema?: string;
      new?: unknown;
      old?: unknown;
    }) => {
      console.info("[PlayRealtimeBridge] realtime event", {
        gameId,
        ...payload,
      });

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        console.info("[PlayRealtimeBridge] router.refresh()", {
          gameId,
          source: payload.source,
          eventType: payload.eventType,
          table: payload.table,
        });
        router.refresh();
      }, 75);
    };

    console.info("[PlayRealtimeBridge] subscription create", {
      gameId,
      channel: channelName,
    });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scored_events",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) =>
          triggerRefresh({
            source: "scored_events",
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old,
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_completions",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) =>
          triggerRefresh({
            source: "game_completions",
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old,
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) =>
          triggerRefresh({
            source: "players",
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old,
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) =>
          triggerRefresh({
            source: "games",
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new,
            old: payload.old,
          }),
      )
      .subscribe((status) => {
        console.info("[PlayRealtimeBridge] subscription status", {
          gameId,
          channel: channelName,
          status,
        });
      });

    return () => {
      console.info("[PlayRealtimeBridge] unmount", { gameId });
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      console.info("[PlayRealtimeBridge] subscription cleanup", {
        gameId,
        channel: channelName,
      });
      supabase.removeChannel(channel);
    };
  }, [gameId, router]);

  return null;
}
