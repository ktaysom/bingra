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
  scoreboardTargetId?: string;
};

export function EndGameCelebration({
  gameId,
  isFinished,
  winner,
  topEntries,
  scoreboardTargetId,
}: EndGameCelebrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

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

  if (!isFinished || !isOpen) {
    return null;
  }

  const close = () => {
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

          <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top finishers</p>
            <ol className="mt-3 space-y-2">
              {topEntries.slice(0, 3).map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <span className="font-semibold text-slate-900">
                    {index + 1}. {entry.name}
                  </span>
                  <span className="text-xs text-slate-600">
                    {entry.finalScore} final · {entry.rawPoints} raw{entry.hasBingra ? " · Bingra x2" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>

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
