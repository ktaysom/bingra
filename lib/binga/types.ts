import type { GameMode } from "./event-catalog";

export type PlayMode = "quick_play" | "streak";

export function mapPlayModeToGameMode(mode: PlayMode): GameMode {
  return mode === "streak" ? "streak" : "classic";
}

export function getPlayModeLabel(mode: PlayMode): string {
  return mode === "streak" ? "Streak Mode" : "Quick Play";
}