"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type LeaderboardEntry = {
  id: string;
  name: string;
  raw_points: number;
  final_score: number;
  has_bingra: boolean;
  is_one_away: boolean;
  completed_cells_count: number;
  join_order: number;
  is_active: boolean;
  status_label?: string;
};

type PreviewCardCell = {
  order_index: number;
  event_label: string;
  team_key: "A" | "B" | null;
  point_value: number;
  threshold: number;
  current_count: number;
  is_completed: boolean;
};

type PlayerCardPreview = {
  player_id: string;
  player_name: string;
  card_accepted_at: string | null;
  completed_cells_count: number;
  total_cells_count: number;
  is_one_away: boolean;
  has_bingra: boolean;
  card_cells: PreviewCardCell[];
};

type LeaderboardCardPreviewProps = {
  leaderboardEntries: LeaderboardEntry[];
  playerCards: PlayerCardPreview[];
  teamNames: { A: string; B: string };
  mode: "streak" | "blackout";
  isLive: boolean;
  playerCount: number;
  scoreboardTargetId: string;
  playersError: string | null;
};

function formatThresholdEventLabel(threshold: number, eventLabel: string): string {
  return `${threshold}+ ${eventLabel}`;
}

function formatProgressCount(currentCount: number, threshold: number): string {
  return `${Math.min(currentCount, threshold)} / ${threshold}`;
}

export function LeaderboardCardPreview({
  leaderboardEntries,
  playerCards,
  teamNames,
  mode,
  isLive,
  playerCount,
  scoreboardTargetId,
  playersError,
}: LeaderboardCardPreviewProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();

  const selectedCard = useMemo(
    () => playerCards.find((card) => card.player_id === selectedPlayerId) ?? null,
    [playerCards, selectedPlayerId],
  );

  useEffect(() => {
    if (!selectedPlayerId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPlayerId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPlayerId]);

  useEffect(() => {
    if (!selectedCard) {
      lastTriggerRef.current?.focus();
      return;
    }

    closeButtonRef.current?.focus();
  }, [selectedCard]);

  return (
    <>
      <section
        id={scoreboardTargetId}
        tabIndex={-1}
        className="surface-card p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Leaderboard</p>
            <h2 className="text-xl font-semibold text-slate-900">Players</h2>
          </div>
          <span className="text-sm text-bingra-gray-medium">{playerCount} joined</span>
        </div>
        <p className="mt-2 text-xs text-bingra-gray-medium">
          {isLive
            ? "Points update live. Bingra badge means this player gets a 2x multiplier when the game ends."
            : "Final score = raw points ×2 with Bingra, otherwise raw points."}
        </p>
        <div className="mt-4 space-y-3">
          {leaderboardEntries.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              onClick={(event) => {
                lastTriggerRef.current = event.currentTarget;
                setSelectedPlayerId(entry.id);
              }}
              className={`group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 active:scale-[0.99] ${
                selectedPlayerId === entry.id
                  ? "bg-violet-50 ring-2 ring-violet-200"
                  : "bg-white/90 hover:bg-slate-50"
              }`}
              aria-label={`View ${entry.name}'s card`}
              aria-pressed={selectedPlayerId === entry.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900" title={entry.name}>
                  {entry.is_active ? `${index + 1}. ${entry.name}` : entry.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {!entry.is_active
                    ? "0 Points • Not active"
                    : isLive
                      ? `${entry.raw_points} Points`
                      : `Final ${entry.final_score} • Raw ${entry.raw_points}${entry.has_bingra ? " • Bingra x2" : ""}`}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:hidden">Tap to view card</p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3">
                <span className={`text-right text-xs font-medium ${
                  !entry.is_active ? "event-state-inactive rounded-full px-2 py-0.5" : "text-bingra-gray-medium"
                }`}>
                  {!entry.is_active
                    ? entry.status_label ?? "No card accepted"
                    : entry.has_bingra
                      ? "Bingra (2x)"
                      : entry.is_one_away
                        ? "One away"
                        : `${entry.completed_cells_count} done`}
                </span>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition ${
                    selectedPlayerId === entry.id ? "bg-violet-100" : "bg-slate-100 group-hover:bg-slate-200"
                  }`}
                  aria-hidden="true"
                >
                  👁
                </span>
              </div>
            </button>
          ))}
        </div>
        {playersError && (
          <p className="mt-4 text-xs text-red-600">Unable to load live player data for this game.</p>
        )}
      </section>

      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:justify-center sm:p-4"
          onClick={() => setSelectedPlayerId(null)}
        >
          <div
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Player card</p>
                <h3 id={headingId} className="break-words text-2xl font-semibold text-slate-900">
                  {selectedCard.player_name}
                </h3>
                {selectedCard.card_accepted_at ? (
                  <>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedCard.completed_cells_count}/{selectedCard.total_cells_count} complete
                    </p>
                    {selectedCard.has_bingra ? (
                      <p className="event-state-completed mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold">Bingra completed</p>
                    ) : selectedCard.is_one_away ? (
                      <p className="mt-1 text-xs font-semibold text-violet-700">1 away from Bingra</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">Card not locked in yet</p>
                )}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelectedPlayerId(null)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                aria-label="Close card preview"
              >
                Close
              </button>
            </div>

            {selectedCard.card_accepted_at ? (
              <div className="mt-5 rounded-2xl bg-white/90 p-3 shadow-sm">
                {mode === "streak" ? (
                  <>
                    <p className="px-1 text-sm font-medium text-slate-600">Streak order</p>
                    <ul className="mt-2 space-y-2">
                      {selectedCard.card_cells.map((cell, index) => {
                        const teamName = cell.team_key ? teamNames[cell.team_key] : null;

                        return (
                          <li
                            key={`${selectedCard.player_id}-${cell.order_index}-${index}`}
                            className={`rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm ${
                              cell.team_key === "A"
                                ? "border-l-blue-400"
                                : cell.team_key === "B"
                                  ? "border-l-emerald-400"
                                  : "border-l-slate-300"
                            } ${cell.is_completed ? "ring-1 ring-blue-300" : ""}`}
                          >
                            <p className="break-words text-sm font-medium text-slate-900">
                              {index + 1}. {formatThresholdEventLabel(cell.threshold, cell.event_label)}
                            </p>
                            {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-slate-500">{cell.point_value} pts</span>
                              <span
                                className={cell.is_completed ? "font-semibold text-blue-600" : "text-slate-500"}
                              >
                                {cell.is_completed
                                  ? "Complete"
                                  : formatProgressCount(cell.current_count, cell.threshold)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="px-1 text-sm font-medium text-slate-600">Card events</p>
                    <ul className="mt-2 space-y-2">
                      {selectedCard.card_cells.map((cell, index) => {
                        const teamName = cell.team_key ? teamNames[cell.team_key] : null;

                        return (
                          <li
                            key={`${selectedCard.player_id}-${cell.order_index}-${index}`}
                            className={`rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm ${
                              cell.team_key === "A"
                                ? "border-l-blue-400"
                                : cell.team_key === "B"
                                  ? "border-l-emerald-400"
                                  : "border-l-slate-300"
                            } ${cell.is_completed ? "ring-1 ring-blue-300" : ""}`}
                          >
                            <p className="break-words text-sm font-medium text-slate-900">
                              {formatThresholdEventLabel(cell.threshold, cell.event_label)}
                            </p>
                            {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-slate-500">{cell.point_value} pts</span>
                              <span
                                className={cell.is_completed ? "font-semibold text-blue-600" : "text-slate-500"}
                              >
                                {cell.is_completed
                                  ? "Complete"
                                  : formatProgressCount(cell.current_count, cell.threshold)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Card not locked in yet
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
