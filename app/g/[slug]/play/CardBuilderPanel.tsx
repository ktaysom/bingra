"use client";

import { useMemo, useState } from "react";

import {
  chooseRandomEvents,
  estimateCardRiskLabel,
  summarizeCardPoints,
  type RiskLevel,
} from "../../../../lib/binga/event-logic";
import type { GameEventType } from "../../../../lib/binga/event-catalog";
import { mapPlayModeToGameMode, type PlayMode } from "../../../../lib/binga/types";

type CardBuilderPanelProps = {
  mode: PlayMode;
  initialRiskLevel: RiskLevel;
  initialCardEvents: GameEventType[];
};

const CARD_EVENT_COUNT = 9;

function generateCardEvents(mode: PlayMode, riskLevel: RiskLevel): GameEventType[] {
  return chooseRandomEvents(CARD_EVENT_COUNT, {
    mode: mapPlayModeToGameMode(mode),
    riskLevel,
    uniqueByEventId: true,
    includeGameScopedEvents: true,
  });
}

export function CardBuilderPanel({
  mode,
  initialRiskLevel,
  initialCardEvents,
}: CardBuilderPanelProps) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initialRiskLevel);
  const [cardEvents, setCardEvents] = useState<GameEventType[]>(initialCardEvents);
  const [isLocked, setIsLocked] = useState(false);

  const cardSummary = useMemo(() => summarizeCardPoints(cardEvents), [cardEvents]);
  const cardRiskLabel = useMemo(() => estimateCardRiskLabel(cardEvents), [cardEvents]);

  const handleGenerateAgain = () => {
    setCardEvents(generateCardEvents(mode, riskLevel));
    setIsLocked(false);
  };

  const handleRiskChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value) as RiskLevel;
    setRiskLevel(nextValue);
    setCardEvents(generateCardEvents(mode, nextValue));
    setIsLocked(false);
  };

  const handleAcceptCard = () => {
    setIsLocked(true);
  };

  const handleReorder = (index: number, direction: "up" | "down") => {
    if (mode !== "streak") return;
    setCardEvents((prev) => {
      const next = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= next.length) {
        return prev;
      }
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  if (isLocked) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
          <h2 className="text-2xl font-semibold text-slate-900">Your card is locked</h2>
          <p className="text-sm text-slate-500">Waiting for the host to start the game.</p>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Compact preview</p>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {cardEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="font-medium">{event.label}</p>
                <p className="text-xs text-slate-500">{event.basePoints} pts</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
        <h2 className="text-2xl font-semibold text-slate-900">Build your card</h2>
        <p className="text-sm text-slate-500">Tune your risk and lock in a card before the host starts the match.</p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk level</p>
            <p className="text-lg font-semibold text-slate-900">{riskLevel} / 5</p>
          </div>
          <div className="flex-1">
            <input
              type="range"
              min={1}
              max={5}
              value={riskLevel}
              onChange={handleRiskChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card points</p>
            <p className="text-lg font-semibold text-slate-900">{Math.round(cardSummary.totalBasePoints)} pts</p>
            <p className="text-xs text-slate-500">{cardRiskLabel}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card preview</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {cardEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{event.label}</p>
                <p className="text-xs text-slate-500">{event.basePoints} pts</p>
              </div>
            ))}
          </div>
        </div>

        {mode === "streak" && (
          <div className="rounded-2xl border border-slate-200 bg-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Streak order</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Next event must follow order</p>
            </div>
            <ul className="divide-y divide-slate-200">
              {cardEvents.map((event, index) => (
                <li key={`${event.id}-reorder`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">{index + 1}. {event.label}</p>
                    <p className="text-xs text-slate-500">{event.basePoints} pts</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "up")}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "down")}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                      disabled={index === cardEvents.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleGenerateAgain}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Generate again
          </button>
          <button
            type="button"
            onClick={handleAcceptCard}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Accept card
          </button>
        </div>
      </div>
    </section>
  );
}
