"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type LeaderboardPreviewEntry = {
  id: string;
  name: string;
  finalScore: number;
  rawPoints: number;
  hasBingra: boolean;
};

type WinnerSummary = {
  name: string;
  finalScore: number;
  rawPoints: number;
  hasBingra: boolean;
};

type EndGameCelebrationProps = {
  gameId: string;
  isFinished: boolean;
  winner: WinnerSummary | null;
  topEntries: LeaderboardPreviewEntry[];
  topPlayerCards: Array<{
    player_id: string;
    player_name: string;
    card_accepted_at: string | null;
    completed_cells_count: number;
    total_cells_count: number;
    is_one_away: boolean;
    has_bingra: boolean;
    card_cells: Array<{
      order_index: number;
      event_label: string;
      team_key: "A" | "B" | null;
      point_value: number;
      threshold: number;
      current_count: number;
      is_completed: boolean;
    }>;
  }>;
  teamNames: { A: string; B: string };
  mode: "streak" | "blackout";
  scoreboardTargetId?: string;
};

function formatThresholdEventLabel(threshold: number, eventLabel: string): string {
  return `${threshold}+ ${eventLabel}`;
}

function formatProgressCount(currentCount: number, threshold: number): string {
  return `${Math.min(currentCount, threshold)} / ${threshold}`;
}

export function EndGameCelebration({
  gameId,
  isFinished,
  winner,
  topEntries,
  topPlayerCards,
  teamNames,
  mode,
  scoreboardTargetId,
}: EndGameCelebrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedTopPlayerId, setSelectedTopPlayerId] = useState<string | null>(null);

  const storageKey = `bingra-finished-${gameId}`;

  useEffect(() => {
    if (!isFinished) {
      setIsOpen(false);
      setAnimateIn(false);
      return;
    }

    try {
      const seen = window.sessionStorage.getItem(storageKey);
      if (seen) {
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
      setIsOpen(true);

      const frame = window.requestAnimationFrame(() => setAnimateIn(true));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      setIsOpen(true);
      const frame = window.requestAnimationFrame(() => setAnimateIn(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isFinished, storageKey]);

  const confettiBits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: `bit-${index}`,
        left: `${5 + ((index * 37) % 90)}%`,
        delay: `${(index % 6) * 0.08}s`,
        duration: `${0.9 + (index % 5) * 0.2}s`,
        hue: (index * 47) % 360,
      })),
    [],
  );

  const selectedTopPlayerCard =
    topPlayerCards.find((card) => card.player_id === selectedTopPlayerId) ?? null;

  if (!isFinished || !isOpen) {
    return null;
  }

  const close = () => {
    setSelectedTopPlayerId(null);
    setAnimateIn(false);
    window.setTimeout(() => setIsOpen(false), 140);
  };

  const handleViewScores = () => {
    close();

    if (!scoreboardTargetId) {
      return;
    }

    window.setTimeout(() => {
      const target = document.getElementById(scoreboardTargetId);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
    }, 160);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        animateIn ? "bg-slate-950/60 backdrop-blur-sm" : "bg-slate-950/0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Game complete"
    >
      <div
        className={`relative w-full max-w-xl overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-fuchsia-50 via-white to-cyan-50 p-5 shadow-2xl transition-all duration-200 sm:p-7 ${
          animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confettiBits.map((bit) => (
            <span
              key={bit.id}
              className="absolute top-[-10%] inline-block h-2.5 w-2.5 animate-[confetti-fall_var(--dur)_ease-in_forwards] rounded-sm opacity-90"
              style={
                {
                  left: bit.left,
                  animationDelay: bit.delay,
                  "--dur": bit.duration,
                  backgroundColor: `hsl(${bit.hue} 92% 58%)`,
                  transform: "translateY(0) rotate(0deg)",
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-3xl shadow-inner shadow-yellow-300/60">
            🏆
          </div>

          <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {winner ? `🏆 ${winner.name} wins!` : "Game over"}
          </h2>

          {winner && (
            <p className="mt-3 text-center text-sm text-slate-600 sm:text-base">
              Final score <span className="font-bold text-slate-900">{winner.finalScore}</span> · Raw{" "}
              <span className="font-semibold text-slate-900">{winner.rawPoints}</span>
              {winner.hasBingra ? " · Bingra x2" : ""}
            </p>
          )}

          {!selectedTopPlayerCard ? (
            <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top finishers</p>
              <ol className="mt-3 space-y-2">
                {topEntries.slice(0, 3).map((entry, index) => {
                  const card = topPlayerCards.find((playerCard) => playerCard.player_id === entry.id) ?? null;

                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!card) {
                            return;
                          }

                          setSelectedTopPlayerId(entry.id);
                        }}
                        disabled={!card}
                        className={`group flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm shadow-sm transition ${
                          card ? "hover:bg-slate-50" : "cursor-not-allowed opacity-70"
                        }`}
                        aria-label={`View ${entry.name}'s final card`}
                      >
                        <span className="font-semibold text-slate-900">
                          {index + 1}. {entry.name}
                        </span>
                        <span className="text-xs text-slate-600">
                          {entry.finalScore} final · {entry.rawPoints} raw{entry.hasBingra ? " · Bingra x2" : ""}
                          {card ? " · View card" : " · Card unavailable"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final card (read-only)</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedTopPlayerCard.player_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTopPlayerId(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to top finishers
                </button>
              </div>

              {selectedTopPlayerCard.card_accepted_at ? (
                <>
                  <p className="mt-2 text-xs text-slate-600">
                    {selectedTopPlayerCard.completed_cells_count}/{selectedTopPlayerCard.total_cells_count} complete
                  </p>

                  <ul className="mt-3 space-y-2">
                    {selectedTopPlayerCard.card_cells.map((cell, index) => {
                      const teamName = cell.team_key ? teamNames[cell.team_key] : null;

                      return (
                        <li
                          key={`${selectedTopPlayerCard.player_id}-${cell.order_index}-${index}`}
                          className={`rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm ${
                            cell.team_key === "A"
                              ? "border-l-blue-400"
                              : cell.team_key === "B"
                                ? "border-l-emerald-400"
                                : "border-l-slate-300"
                          } ${cell.is_completed ? "ring-1 ring-blue-300" : ""}`}
                        >
                          <p className="break-words text-sm font-medium text-slate-900">
                            {mode === "streak" ? `${index + 1}. ` : ""}
                            {formatThresholdEventLabel(cell.threshold, cell.event_label)}
                          </p>
                          {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{cell.point_value} pts</span>
                            <span className={cell.is_completed ? "font-semibold text-blue-600" : "text-slate-500"}>
                              {cell.is_completed ? "Complete" : formatProgressCount(cell.current_count, cell.threshold)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Card was not locked in at game end for this player.
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleViewScores}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-400/40 transition hover:bg-violet-500"
            >
              View final scores
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 0.95;
          }
          100% {
            transform: translateY(90vh) rotate(520deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
