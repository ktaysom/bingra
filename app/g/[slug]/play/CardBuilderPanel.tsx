"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import {
  chooseRandomEvents,
  estimateCardRiskLabel,
  getEventsForMode,
  summarizeCardPoints,
  type TeamKey,
  type RiskLevel,
} from "../../../../lib/bingra/event-logic";
import type { EventCategory, GameEventType } from "../../../../lib/bingra/event-catalog";
import { mapPlayModeToGameMode, type PlayMode } from "../../../../lib/bingra/types";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { generateCardAction } from "../../../actions/generate-card";
type GameTeamScope = "both_teams" | "team_a_only" | "team_b_only";

type CardBuilderEvent = GameEventType & {
  marked?: boolean;
  cardTeamKey?: TeamKey | null;
};

type CardBuilderPanelProps = {
  mode: PlayMode;
  playerId: string | null;
  eventsPerCard: number;
  teamScope: GameTeamScope;
  endCondition: "FIRST_COMPLETION" | "HOST_DECLARED";
  teamNames: Record<TeamKey, string>;
  initialRiskLevel: RiskLevel;
  initialCardEvents: CardBuilderEvent[];
  lockedCardEvents: CardBuilderEvent[];
};

type AddableEvent = {
  identityKey: string;
  eventName: string;
  teamName: string | null;
  cardTeamKey: TeamKey | null;
  groupLabel: string;
  event: GameEventType;
};

type AddFilterKey = "team-a" | "team-b" | "neutral" | "scoring" | "possession";

function stripTeamPrefix(label: string, teamName: string | null): string {
  if (!teamName) return label;

  const prefix = `${teamName}: `;
  if (label.startsWith(prefix)) {
    return label.slice(prefix.length);
  }

  return label;
}

function getIdentityTone(teamKey: TeamKey | null): { container: string } {
  if (teamKey === "A") {
    return {
      container: "border border-blue-200 border-l-4 border-l-blue-400 bg-white/90 shadow-sm",
    };
  }

  if (teamKey === "B") {
    return {
      container: "border border-emerald-200 border-l-4 border-l-emerald-400 bg-white/90 shadow-sm",
    };
  }

  return {
    container: "border border-slate-200 border-l-4 border-l-slate-300 bg-white/90 shadow-sm",
  };
}

function isPossessionStyleEvent(event: GameEventType): boolean {
  return (
    event.scorerParentCategory === "change-of-possession" ||
    event.category === "defense" ||
    event.category === "turnover" ||
    event.category === "violation" ||
    event.category === "hustle"
  );
}

function matchesAddFilter(filter: AddFilterKey, candidate: AddableEvent): boolean {
  const category: EventCategory = candidate.event.category;

  switch (filter) {
    case "team-a":
      return candidate.cardTeamKey === "A";
    case "team-b":
      return candidate.cardTeamKey === "B";
    case "neutral":
      return candidate.cardTeamKey == null;
    case "scoring":
      return category === "scoring" || category === "free-throw";
    case "possession":
      return isPossessionStyleEvent(candidate.event);
    default:
      return true;
  }
}

function resolveTeamKey(
  teamScope: GameTeamScope,
  event: GameEventType,
  index: number,
): TeamKey | null {
  if (event.teamScope !== "team") {
    return null;
  }

  if (teamScope === "team_a_only") {
    return "A";
  }

  if (teamScope === "team_b_only") {
    return "B";
  }

  return index % 2 === 0 ? "A" : "B";
}

function getDisplayLabel(event: GameEventType): string {
  return event.label;
}

function generateCardEvents(
  mode: PlayMode,
  riskLevel: RiskLevel,
  eventsPerCard: number,
  teamScope: GameTeamScope,
  teamNames: Record<TeamKey, string>,
): CardBuilderEvent[] {
  return chooseRandomEvents(eventsPerCard, {
    mode: mapPlayModeToGameMode(mode),
    riskLevel,
    uniqueByEventId: true,
    includeGameScopedEvents: teamScope === "both_teams",
  }).map((event, index) => {
    const cardTeamKey = resolveTeamKey(teamScope, event, index);

    return {
      ...event,
      label: getDisplayLabel(event),
      shortLabel: getDisplayLabel(event),
      cardTeamKey,
    };
  });
}

export function CardBuilderPanel({
  mode,
  playerId,
  eventsPerCard,
  teamScope,
  endCondition,
  teamNames,
  initialRiskLevel,
  initialCardEvents,
  lockedCardEvents,
}: CardBuilderPanelProps) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initialRiskLevel);
  const [cardEvents, setCardEvents] = useState<CardBuilderEvent[]>(() =>
    initialCardEvents.map((event) => {
      const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;

      return {
        ...event,
        label: stripTeamPrefix(event.label, teamName),
        shortLabel: stripTeamPrefix(event.shortLabel, teamName),
      };
    }),
  );
  const [isLocked, setIsLocked] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<AddFilterKey>>(new Set());
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const router = useRouter();

  const [generateState, generateAction] = useActionState(generateCardAction, {});
  const hasPersistedLockedCard =
    lockedCardEvents.length > 0 && lockedCardEvents !== initialCardEvents;
  const shouldRenderLocked = hasPersistedLockedCard || isLocked;

  const cardSummary = useMemo(() => summarizeCardPoints(cardEvents), [cardEvents]);
  const cardRiskLabel = useMemo(() => estimateCardRiskLabel(cardEvents), [cardEvents]);

  const addableEvents = useMemo<AddableEvent[]>(() => {
    const modeEvents = getEventsForMode(mapPlayModeToGameMode(mode));
    const items: AddableEvent[] = [];

    for (const event of modeEvents) {
      if (event.teamScope === "team") {
        if (teamScope === "both_teams") {
          for (const teamKey of ["A", "B"] as const) {
            items.push({
              identityKey: `${event.id}:${teamKey}`,
              eventName: event.label,
              teamName: teamNames[teamKey],
              cardTeamKey: teamKey,
              groupLabel: `${teamNames[teamKey]} events`,
              event,
            });
          }
          continue;
        }

        const scopedTeam = teamScope === "team_a_only" ? "A" : "B";
        items.push({
          identityKey: `${event.id}:${scopedTeam}`,
          eventName: event.label,
          teamName: teamNames[scopedTeam],
          cardTeamKey: scopedTeam,
          groupLabel: `${teamNames[scopedTeam]} events`,
          event,
        });
        continue;
      }

      items.push({
        identityKey: `${event.id}:NONE`,
        eventName: event.label,
        teamName: null,
        cardTeamKey: null,
        groupLabel: "Neutral events",
        event,
      });
    }

    const groupOrder = (label: string) => {
      if (label === "Team A events") return 0;
      if (label === "Team B events") return 1;
      if (label === "Team events") return 2;
      return 3;
    };

    return items.sort((a, b) => {
      const groupDelta = groupOrder(a.groupLabel) - groupOrder(b.groupLabel);
      if (groupDelta !== 0) return groupDelta;
      return a.eventName.localeCompare(b.eventName);
    });
  }, [mode, teamScope, teamNames]);

  const selectedIdentityKeys = useMemo(() => {
    return new Set(cardEvents.map((event) => `${event.id}:${event.cardTeamKey ?? "NONE"}`));
  }, [cardEvents]);

  const addableGroups = useMemo(() => {
    return addableEvents
      .filter((item) => {
        if (activeFilters.size === 0) return true;
        return Array.from(activeFilters).every((filter) => matchesAddFilter(filter, item));
      })
      .reduce<Record<string, AddableEvent[]>>((groups, item) => {
      if (!groups[item.groupLabel]) {
        groups[item.groupLabel] = [];
      }
      groups[item.groupLabel].push(item);
      return groups;
    }, {});
  }, [addableEvents, activeFilters]);

  const missingEventsCount = Math.max(0, eventsPerCard - cardEvents.length);
  const isCardReadyToAccept = cardEvents.length === eventsPerCard;
  const canAddMoreEvents = cardEvents.length < eventsPerCard;

  const handleGenerateAgain = () => {
    setCardEvents(generateCardEvents(mode, riskLevel, eventsPerCard, teamScope, teamNames));
    setIsLocked(false);
  };

  const handleRiskChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value) as RiskLevel;
    setRiskLevel(nextValue);
    setCardEvents(generateCardEvents(mode, nextValue, eventsPerCard, teamScope, teamNames));
    setIsLocked(false);
  };

  const handleAcceptCard = () => {
    if (!playerId || !isCardReadyToAccept) return;

    const selectedEventKeys = cardEvents.map((event) => event.id);
    const acceptedEvents = cardEvents.map((event, index) => ({
      eventKey: event.id,
      eventLabel: stripTeamPrefix(
        event.label,
        event.cardTeamKey ? teamNames[event.cardTeamKey] : null,
      ),
      pointValue: event.basePoints,
      teamKey: event.cardTeamKey ?? null,
      orderIndex: index,
    }));

    startTransition(() => {
      generateAction({
        playerId,
        targetCount: selectedEventKeys.length,
        selectedEventKeys,
        acceptedEvents,
        selectionMode: "custom",
      });
    });
  };

  const handleRemoveEvent = (index: number) => {
    setCardEvents((prev) => prev.filter((_, eventIndex) => eventIndex !== index));
  };

  const handleAddEvent = (candidate: AddableEvent) => {
    if (!canAddMoreEvents) return;
    if (selectedIdentityKeys.has(candidate.identityKey)) return;

    setCardEvents((prev) => [
      ...prev,
      {
        ...candidate.event,
        label: candidate.eventName,
        shortLabel: candidate.eventName,
        cardTeamKey: candidate.cardTeamKey,
      },
    ]);

    if (cardEvents.length + 1 >= eventsPerCard) {
      setIsAddSheetOpen(false);
    }
  };

  useEffect(() => {
    if (generateState.success) {
      setIsLocked(true);
      router.refresh();
    }
  }, [generateState.success, router]);

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

  const toggleFilter = (filter: AddFilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    if (mode !== "streak") return;
    setDragIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (mode !== "streak") return;
    if (dragIndex == null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }

    setCardEvents((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDragIndex(null);
  };

  if (shouldRenderLocked) {
    const lockedCard = hasPersistedLockedCard ? lockedCardEvents : cardEvents;

    return (
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
          <h2 className="text-2xl font-semibold text-slate-900">Your card is locked</h2>
          <p className="text-sm text-slate-500">Waiting for the host to start the game.</p>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-white/90 p-4 shadow-sm">
          {mode === "streak" ? (
            <>
              <p className="text-sm font-medium text-slate-600">Streak order</p>
              <div className="rounded-2xl bg-white/90 shadow-sm">
                <ul className="divide-y divide-slate-200">
                  {lockedCard.map((event, index) => {
                    const tone = getIdentityTone(event.cardTeamKey ?? null);
                    const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;

                    return (
                      <li
                        key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container} ${
                          event.marked ? "ring-1 ring-blue-300" : ""
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {index + 1}. {stripTeamPrefix(event.label, teamName)}
                          </p>
                          {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                          <p className="text-xs text-slate-500">{event.basePoints} pts</p>
                        </div>
                        {event.marked && (
                          <p className="text-xs font-semibold text-blue-600">Complete</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Compact preview</p>
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                {lockedCard.map((event, index) => (
                  (() => {
                    const tone = getIdentityTone(event.cardTeamKey ?? null);
                    const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;

                    return (
                  <div
                    key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                    className={`rounded-lg px-3 py-2 ${tone.container} ${
                      event.marked ? "ring-1 ring-blue-300" : ""
                    }`}
                  >
                    <p className="font-medium text-slate-900">{stripTeamPrefix(event.label, teamName)}</p>
                    {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                    <p className="text-xs text-slate-500">{event.basePoints} pts</p>
                    {event.marked && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        Complete
                      </p>
                    )}
                  </div>
                    );
                  })()
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
        <h2 className="text-2xl font-semibold text-slate-900">Build card</h2>
        <p className="text-xs text-slate-600">
          {mode === "streak" ? "Streak order" : "Blackout"} • Risk {riskLevel}/5 • {Math.round(cardSummary.totalBasePoints)} pts • {endCondition === "FIRST_COMPLETION" ? "first complete wins" : "host ends: highest completed-card points"}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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

        {mode === "streak" ? (
          <div>
            <div className="mt-3 rounded-2xl bg-white/90 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Streak order</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Drag to reorder</p>
            </div>
            <ul className="divide-y divide-slate-200">
              {cardEvents.map((event, index) => (
                (() => {
                  const tone = getIdentityTone(event.cardTeamKey ?? null);

                  return (
                <li
                  key={`${event.id}-${event.cardTeamKey ?? "NONE"}-reorder`}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                >
                  <div>
                    <p className="font-medium text-slate-900">{index + 1}. {stripTeamPrefix(event.label, event.cardTeamKey ? teamNames[event.cardTeamKey] : null)}</p>
                    {event.cardTeamKey && (
                      <p className="text-[11px] text-slate-500">{teamNames[event.cardTeamKey]}</p>
                    )}
                    <p className="text-xs text-slate-500">{event.basePoints} pts</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveEvent(index)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-sm font-semibold text-red-600 shadow-sm"
                      aria-label={`Remove ${event.label}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
                  );
                })()
              ))}
            </ul>
          </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card events</p>
            <div className="mx-auto mt-3 max-w-2xl rounded-2xl bg-white/90 shadow-sm">
              <ul className="divide-y divide-slate-200">
                {cardEvents.map((event, index) => {
                  const tone = getIdentityTone(event.cardTeamKey ?? null);
                  const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;

                  return (
                    <li
                      key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                      className={`flex items-start justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{stripTeamPrefix(event.label, teamName)}</p>
                        {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                        <p className="text-xs text-slate-500">{event.basePoints} pts</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvent(index)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-sm font-semibold text-red-600 shadow-sm"
                        aria-label={`Remove ${event.label}`}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <section className="rounded-2xl bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add events</p>
              <p className="text-xs text-slate-500">
                {isCardReadyToAccept
                  ? "Card is full. Remove an event to add another."
                  : `${missingEventsCount} more event${missingEventsCount === 1 ? "" : "s"} needed to accept.`}
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              {cardEvents.length}/{eventsPerCard}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddSheetOpen((prev) => !prev)}
            className="mt-3 w-full rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            {isAddSheetOpen ? "Hide add events" : "Browse add events"}
          </button>

          {isAddSheetOpen && (
            <div className="mt-3 rounded-2xl bg-white/90 p-3 shadow-sm">
              <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                {([
                  { key: "all", label: "All" },
                  { key: "team-a", label: teamNames.A },
                  { key: "team-b", label: teamNames.B },
                  { key: "neutral", label: "Neutral" },
                  { key: "scoring", label: "Scoring" },
                  { key: "possession", label: "Possession" },
                ] as const).map((chip) => {
                  const selected =
                    chip.key === "all"
                      ? activeFilters.size === 0
                      : activeFilters.has(chip.key);

                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => {
                        if (chip.key === "all") {
                          setActiveFilters(new Set());
                          return;
                        }

                        toggleFilter(chip.key);
                      }}
                      className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                        selected
                          ? "bg-[#2f6df6] text-white"
                          : "bg-white/90 text-slate-700 shadow-sm"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-4">
                {Object.entries(addableGroups).map(([groupName, events]) => (
                  <div key={groupName}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{groupName}</p>
                    <ul className="mt-2 space-y-2">
                      {events.map((event) => {
                        const alreadyOnCard = selectedIdentityKeys.has(event.identityKey);
                        const disabled = alreadyOnCard || !canAddMoreEvents;
                        const tone = getIdentityTone(event.cardTeamKey);

                        return (
                          <li
                            key={event.identityKey}
                            className={`flex items-center justify-between gap-3 rounded-xl p-3 ${tone.container}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{event.eventName}</p>
                              {event.teamName && (
                                <p className="text-[11px] text-slate-500">{event.teamName}</p>
                              )}
                              <p className="text-xs text-slate-500">{event.event.basePoints} pts</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddEvent(event)}
                              disabled={disabled}
                              className="rounded-2xl bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50"
                            >
                              {alreadyOnCard ? "Added" : "Add"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {Object.keys(addableGroups).length === 0 && (
                  <p className="rounded-2xl bg-white/90 px-3 py-3 text-xs text-slate-500 shadow-sm">
                    No events match this filter right now.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleGenerateAgain}
            className="rounded-2xl bg-white/90 px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:scale-[1.02]"
          >
            Generate again
          </button>
          <button
            type="button"
            onClick={handleAcceptCard}
            className="rounded-2xl bg-[#2f6df6] px-5 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6df6]"
            disabled={!playerId || !isCardReadyToAccept}
          >
            Accept card
          </button>
        </div>
      {!isCardReadyToAccept && (
        <p className="mt-2 text-xs text-amber-700">
          Add {missingEventsCount} more event{missingEventsCount === 1 ? "" : "s"} before accepting.
        </p>
      )}
      {generateState.error && (
        <p className="mt-3 text-xs text-red-600">{generateState.error}</p>
      )}
      </div>

    </section>
  );
}
