"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  buildPreferredShareUrl,
  buildGameUrl,
  buildResultsCardUrl,
  buildResultsShareText,
  getPublicBaseUrl,
} from "../../../../lib/share/share";
import { ShareSheet } from "../../../../components/share/ShareSheet";

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
  slug: string;
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
      required_count?: number;
      current_count: number;
      is_completed: boolean;
    }>;
  }>;
  teamNames: { A: string; B: string };
  matchup: { teamA: string; teamB: string };
  mode: "streak" | "blackout";
  scoreboardTargetId?: string;
};

function formatThresholdEventLabel(requiredCount: number, eventLabel: string): string {
  return `${requiredCount}+ ${eventLabel}`;
}

function formatProgressCount(currentCount: number, requiredCount: number): string {
  return `${Math.min(currentCount, requiredCount)} / ${requiredCount}`;
}

export function EndGameCelebration({
  gameId,
  slug,
  isFinished,
  winner,
  topEntries,
  topPlayerCards,
  teamNames,
  matchup,
  mode,
  scoreboardTargetId,
}: EndGameCelebrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedTopPlayerId, setSelectedTopPlayerId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

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

  const { baseUrl, gameUrl, isLocalOnlyShare } = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : getPublicBaseUrl();
    const preferredShareUrl = buildPreferredShareUrl(slug, origin);

    return {
      baseUrl: origin,
      gameUrl: preferredShareUrl ?? buildGameUrl(slug, origin),
      isLocalOnlyShare: !preferredShareUrl,
    };
  }, [slug]);

  const resultsShareText = useMemo(
    () =>
      buildResultsShareText({
        teamA: matchup.teamA,
        teamB: matchup.teamB,
        winnerName: winner?.name ?? null,
        winnerFinalScore: winner?.finalScore ?? null,
        gameUrl,
      }),
    [gameUrl, matchup.teamA, matchup.teamB, winner?.finalScore, winner?.name],
  );

  const resultsCardUrl = useMemo(
    () =>
      buildResultsCardUrl({
        slug,
        baseUrl,
        teamA: matchup.teamA,
        teamB: matchup.teamB,
        winnerName: winner?.name ?? null,
        winnerFinalScore: winner?.finalScore ?? null,
      }),
    [baseUrl, matchup.teamA, matchup.teamB, slug, winner?.finalScore, winner?.name],
  );

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

  const copyResultsText = async () => {
    try {
      await navigator.clipboard.writeText(resultsShareText);
      setShareFeedback("Results text copied");
    } catch {
      setShareFeedback("Could not copy results text");
    }
  };

  const copyResultsCardLink = async () => {
    try {
      await navigator.clipboard.writeText(resultsCardUrl);
      setShareFeedback("Results card link copied");
    } catch {
      setShareFeedback("Could not copy results card link");
    }
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
                      const requiredCount =
                        typeof cell.required_count === "number" ? cell.required_count : cell.threshold;

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
                            {formatThresholdEventLabel(requiredCount, cell.event_label)}
                          </p>
                          {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{cell.point_value} pts</span>
                            <span className={cell.is_completed ? "font-semibold text-blue-600" : "text-slate-500"}>
                              {cell.is_completed ? "Complete" : formatProgressCount(cell.current_count, requiredCount)}
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
              onClick={() => setShareSheetOpen(true)}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-400/40 transition hover:bg-blue-500"
            >
              Share results
            </button>
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

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share results</p>
            <p className="mt-1 text-xs text-slate-600">
              Share your public-safe game result text or card image.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyResultsText}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Copy result text
              </button>
              <button
                type="button"
                onClick={copyResultsCardLink}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Copy result card link
              </button>
            </div>
            <a
              href={resultsCardUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open result card image
            </a>
            {shareFeedback ? <p className="mt-2 text-xs text-slate-500">{shareFeedback}</p> : null}
          </section>
        </div>
      </div>

      <ShareSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        title="Share results"
        shareText={resultsShareText}
        shareUrl={gameUrl}
        isLocalOnly={isLocalOnlyShare}
      />

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
