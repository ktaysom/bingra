"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  chooseRiskCalibratedCardCells,
  getEventMaxThreshold,
  getEventPointsForProfile,
  getEventsForMode,
  type TeamKey,
  type RiskLevel,
} from "../../../../lib/bingra/event-logic";
import { buildCardCellEventKey } from "../../../../lib/bingra/card-event-key";
import type { EventCategory, GameEventType } from "../../../../lib/bingra/event-catalog";
import { mapPlayModeToGameMode, type PlayMode } from "../../../../lib/bingra/types";
import { getThresholdScoreMultiplier } from "../../../../lib/bingra/game-scoring";
import { getRequiredCountForThresholdLevel } from "../../../../lib/bingra/threshold-levels";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { generateCardAction } from "../../../actions/generate-card";
import { editCardAction } from "../../../actions/edit-card";
import { AuthDialog } from "../../../../components/auth/AuthDialog";
import {
  DEFAULT_SPORT_PROFILE,
  type SportProfileKey,
} from "../../../../lib/bingra/sport-profiles";
type GameTeamScope = "both_teams" | "team_a_only" | "team_b_only";

type CardBuilderEvent = GameEventType & {
  marked?: boolean;
  cardTeamKey?: TeamKey | null;
  threshold: number;
  required_count?: number;
  current_count?: number;
  remaining_count?: number;
  is_completed?: boolean;
};

type CardBuilderPanelProps = {
  slug: string;
  isAuthenticatedUser: boolean;
  mode: PlayMode;
  playerId: string | null;
  gameStatus: "lobby" | "live" | "finished";
  cardAcceptedAt: string | null;
  eventsPerCard: number;
  teamScope: GameTeamScope;
  endCondition: "FIRST_COMPLETION" | "HOST_DECLARED";
  teamNames: Record<TeamKey, string>;
  initialRiskLevel: RiskLevel;
  initialCardEvents: CardBuilderEvent[];
  lockedCardEvents: CardBuilderEvent[];
  sportProfile: SportProfileKey;
};

type AddableEvent = {
  identityKey: string;
  eventName: string;
  teamName: string | null;
  cardTeamKey: TeamKey | null;
  groupLabel: string;
  basePoints: number;
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

function getCardEventIdentityKey(event: CardBuilderEvent): string {
  return `${event.id}:${event.cardTeamKey ?? "NONE"}`;
}

function getAddableEventIdentityKey(candidate: AddableEvent): string {
  return `${candidate.event.id}:${candidate.cardTeamKey ?? "NONE"}`;
}

function formatThresholdEventLabel(requiredCount: number, eventLabel: string): string {
  return `${requiredCount}+ ${eventLabel}`;
}

function formatProgressCount(currentCount: number, requiredCount: number): string {
  return `${Math.min(currentCount, requiredCount)} / ${requiredCount}`;
}

function toSafePoints(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getThresholdPreviewPoints(event: CardBuilderEvent, sportProfile: SportProfileKey): number {
  const threshold = typeof event.threshold === "number" && Number.isFinite(event.threshold)
    ? event.threshold
    : 1;
  const basePoints = toSafePoints(getEventPointsForProfile(event, sportProfile));

  return Math.round(basePoints * getThresholdScoreMultiplier(threshold));
}

function getRiskLevelLabel(riskLevel: RiskLevel): string {
  if (riskLevel >= 4) {
    return "High Risk";
  }

  if (riskLevel <= 2) {
    return "Low Risk";
  }

  return "Medium Risk";
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function isPossessionStyleEvent(event: GameEventType): boolean {
  return (
    event.scorerParentCategory === "change-of-possession" ||
    event.category === "change_of_possession"
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
      return category === "score";
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
  sportProfile: SportProfileKey,
): CardBuilderEvent[] {
  return chooseRiskCalibratedCardCells(eventsPerCard, {
    mode: mapPlayModeToGameMode(mode),
    riskLevel,
    uniqueByEventId: true,
    includeGameScopedEvents: teamScope === "both_teams",
    profile: sportProfile,
  }).map((cell, index) => {
    const event = cell.event;
    const cardTeamKey = resolveTeamKey(teamScope, event, index);

    return {
      ...event,
      label: getDisplayLabel(event),
      shortLabel: getDisplayLabel(event),
      cardTeamKey,
      threshold: cell.threshold,
      required_count: getRequiredCountForThresholdLevel(event, sportProfile, cell.threshold),
    };
  });
}

export function CardBuilderPanel({
  slug,
  isAuthenticatedUser,
  mode,
  playerId,
  gameStatus,
  cardAcceptedAt,
  eventsPerCard,
  teamScope,
  endCondition,
  teamNames,
  initialRiskLevel,
  initialCardEvents,
  lockedCardEvents,
  sportProfile = DEFAULT_SPORT_PROFILE,
}: CardBuilderPanelProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initialRiskLevel);
  const [cardEvents, setCardEvents] = useState<CardBuilderEvent[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<AddFilterKey>>(new Set());
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
  const [expandedAddEventIdentityKeys, setExpandedAddEventIdentityKeys] = useState<Set<string>>(
    new Set(),
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [touchDragItemId, setTouchDragItemId] = useState<string | null>(null);
  const touchLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPointerStateRef = useRef<{ pointerId: number; itemId: string } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const router = useRouter();

  const [generateState, generateAction, isSubmitting] = useActionState(generateCardAction, {});
  const [editState, editAction, isEditSubmitting] = useActionState(editCardAction, {});
  const [acceptFeedback, setAcceptFeedback] = useState<string | null>(null);
  const [acceptActionError, setAcceptActionError] = useState<string | null>(null);
  const [showAutoBuildSuccess, setShowAutoBuildSuccess] = useState(false);
  const [showPostLockSignInPrompt, setShowPostLockSignInPrompt] = useState(false);
  const previousAcceptedAtRef = useRef<string | null>(cardAcceptedAt);
  const isAccepted = Boolean(cardAcceptedAt);
  const isPermanentlyLocked = isAccepted && gameStatus !== "lobby";
  const isTemporarilyAccepted = isAccepted && gameStatus === "lobby";
  const shouldRenderLockedPreview = isPermanentlyLocked || isTemporarilyAccepted;

  const cardTotalPoints = useMemo(
    () => cardEvents.reduce((sum, event) => sum + getThresholdPreviewPoints(event, sportProfile), 0),
    [cardEvents, sportProfile],
  );
  const cardRiskLabel = useMemo(() => getRiskLevelLabel(riskLevel), [riskLevel]);

  const addableEvents = useMemo<AddableEvent[]>(() => {
    const modeEvents = getEventsForMode(mapPlayModeToGameMode(mode), sportProfile);
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
              basePoints: getEventPointsForProfile(event, sportProfile),
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
          basePoints: getEventPointsForProfile(event, sportProfile),
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
        basePoints: getEventPointsForProfile(event, sportProfile),
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
      const basePointDelta = a.basePoints - b.basePoints;
      if (basePointDelta !== 0) return basePointDelta;
      return a.eventName.localeCompare(b.eventName);
    });
  }, [mode, teamScope, teamNames, sportProfile]);

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
  const shouldShowEventList = !isCardReadyToAccept || isEventListExpanded;
  const picksSelectedCount = cardEvents.length;
  const picksProgressLabel = `${picksSelectedCount} / ${eventsPerCard} picks selected`;
  const onboardingHeadline = `Make ${eventsPerCard} picks to play`;
  const visibleCardSlots = useMemo<(CardBuilderEvent | null)[]>(
    () => Array.from({ length: 5 }, (_, index) => cardEvents[index] ?? null),
    [cardEvents],
  );

  const handleAutoBuildCard = () => {
    setCardEvents(
      generateCardEvents(mode, riskLevel, eventsPerCard, teamScope, teamNames, sportProfile),
    );
    setShowAutoBuildSuccess(true);
  };

  const handleAutoBuildClick = () => {
    handleAutoBuildCard();
  };

  const handleRiskChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value) as RiskLevel;
    setRiskLevel(nextValue);

    if (cardEvents.length === 0) {
      return;
    }

    setCardEvents(
      generateCardEvents(mode, nextValue, eventsPerCard, teamScope, teamNames, sportProfile),
    );
  };

  const handleAcceptCard = () => {
    console.info("[CardBuilderPanel] Accept card clicked", {
      playerId,
      isCardReadyToAccept,
      isHydrated,
      isSubmitting,
      cardEventsCount: cardEvents.length,
      eventsPerCard,
    });

    if (!isHydrated || isSubmitting || !playerId || !isCardReadyToAccept) {
      const clientError = !isHydrated
        ? "Card builder is still loading. Please try again."
        : isSubmitting
          ? "Card acceptance is already in progress."
          : !playerId
            ? "You need to join this game before you can accept a card."
            : "Add all required events before accepting your card.";

      setAcceptActionError(clientError);
      console.info("[CardBuilderPanel] Accept card blocked", {
        reason: !isHydrated
          ? "not_hydrated"
          : isSubmitting
            ? "submission_pending"
            : !playerId
              ? "missing_player_id"
              : "card_not_ready",
      });
      return;
    }

    setAcceptActionError(null);

    const selectedEventKeys = cardEvents.map((event) => event.id);
    const acceptedEvents = cardEvents.map((event, index) => ({
      eventId: event.id,
      eventKey: buildCardCellEventKey(event.id, event.cardTeamKey ?? null),
      eventLabel: stripTeamPrefix(
        event.label,
        event.cardTeamKey ? teamNames[event.cardTeamKey] : null,
      ),
      pointValue: getEventPointsForProfile(event, sportProfile),
      team: event.cardTeamKey ?? null,
      teamKey: event.cardTeamKey ?? null,
      threshold: event.threshold,
      orderIndex: index,
    }));

    console.info("[CardBuilderPanel] dispatching generateCardAction", {
      playerId,
      selectedEventKeys,
      acceptedEventsCount: acceptedEvents.length,
    });

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

  const handleAddEventWithThreshold = (candidate: AddableEvent, threshold: number) => {
    if (!canAddMoreEvents) return;
    const identityKey = getAddableEventIdentityKey(candidate);
    if (selectedIdentityKeys.has(identityKey)) return;

    setCardEvents((prev) => [
      ...prev,
      {
        ...candidate.event,
        label: candidate.eventName,
        shortLabel: candidate.eventName,
        cardTeamKey: candidate.cardTeamKey,
        threshold,
        required_count: getRequiredCountForThresholdLevel(candidate.event, sportProfile, threshold),
      },
    ]);

    setExpandedAddEventIdentityKeys((prev) => {
      const next = new Set(prev);
      next.delete(identityKey);
      return next;
    });
  };

  const handleToggleAddableEvent = (candidate: AddableEvent) => {
    const identityKey = getAddableEventIdentityKey(candidate);
    const existingIndex = cardEvents.findIndex(
      (event) => getCardEventIdentityKey(event) === identityKey,
    );

    if (existingIndex >= 0) {
      setCardEvents((prev) => prev.filter((_, index) => index !== existingIndex));
      setExpandedAddEventIdentityKeys((prev) => {
        const next = new Set(prev);
        next.delete(identityKey);
        return next;
      });
      return;
    }

    if (!canAddMoreEvents) {
      return;
    }

    setExpandedAddEventIdentityKeys((prev) => {
      const next = new Set(prev);
      if (next.has(identityKey)) {
        next.delete(identityKey);
      } else {
        next.add(identityKey);
      }
      return next;
    });

    if (canAddMoreEvents) {
      setExpandedAddEventIdentityKeys((prev) => {
        const next = new Set(prev);
        next.add(identityKey);
        return next;
      });
    }
  };

  const handleCollapseAddableEvent = (identityKey: string) => {
    setExpandedAddEventIdentityKeys((prev) => {
      const next = new Set(prev);
      next.delete(identityKey);
      return next;
    });
  };

  useEffect(() => {
    if (!showAutoBuildSuccess) return;

    const timer = setTimeout(() => {
      setShowAutoBuildSuccess(false);
    }, 4500);

    return () => clearTimeout(timer);
  }, [showAutoBuildSuccess]);

  useEffect(() => {
    if (isCardReadyToAccept) {
      setIsEventListExpanded(false);
      return;
    }

    setIsEventListExpanded(true);
  }, [isCardReadyToAccept]);

  useEffect(() => {
    setIsHydrated(true);
    console.info("[CardBuilderPanel] mount", {
      mode,
      playerId,
      eventsPerCard,
      initialCardEventsCount: initialCardEvents.length,
    });
  }, [eventsPerCard, initialCardEvents.length, mode, playerId]);

  useEffect(() => {
    if (generateState.success) {
      setAcceptActionError(null);
      setAcceptFeedback(
        gameStatus === "live"
          ? "You're live — scoring has started"
          : "Card locked. You can still edit before game starts",
      );
      router.refresh();
    }
  }, [gameStatus, generateState.success, router]);

  useEffect(() => {
    const previousAcceptedAt = previousAcceptedAtRef.current;
    const transitionedToAccepted = !previousAcceptedAt && Boolean(cardAcceptedAt);
    previousAcceptedAtRef.current = cardAcceptedAt;

    if (!transitionedToAccepted || !cardAcceptedAt || !playerId || isAuthenticatedUser) {
      return;
    }

    const storageKey = `bingra-post-lock-signin-prompt:${slug}:${playerId}:${cardAcceptedAt}`;

    try {
      const alreadyPrompted = window.sessionStorage.getItem(storageKey);
      if (alreadyPrompted) {
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
      setShowPostLockSignInPrompt(true);
    } catch {
      setShowPostLockSignInPrompt(true);
    }
  }, [cardAcceptedAt, isAuthenticatedUser, playerId, slug]);

  useEffect(() => {
    if (isAuthenticatedUser) {
      setShowPostLockSignInPrompt(false);
    }
  }, [isAuthenticatedUser]);

  useEffect(() => {
    if (generateState.error) {
      setAcceptActionError(generateState.error);
    }
  }, [generateState.error]);

  useEffect(() => {
    if (editState.success) {
      router.refresh();
    }
  }, [editState.success, router]);

  useEffect(() => {
    if (!isHydrated) return;
    console.info("[CardBuilderPanel] submission state", {
      isSubmitting,
      success: generateState.success,
      error: generateState.error,
    });
  }, [generateState.error, generateState.success, isHydrated, isSubmitting]);

  useEffect(() => {
    return () => {
      if (touchLongPressTimerRef.current) {
        clearTimeout(touchLongPressTimerRef.current);
      }
    };
  }, []);

  const clearTouchDragState = () => {
    if (touchLongPressTimerRef.current) {
      clearTimeout(touchLongPressTimerRef.current);
      touchLongPressTimerRef.current = null;
    }
    touchPointerStateRef.current = null;
    touchStartRef.current = null;
    setTouchDragItemId(null);
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

    setCardEvents((prev) => moveItem(prev, dragIndex, targetIndex));
    setDragIndex(null);
  };

  const handleTouchHandlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    itemId: string,
  ) => {
    if (mode !== "streak" || event.pointerType !== "touch") return;

    touchPointerStateRef.current = {
      pointerId: event.pointerId,
      itemId,
    };
    touchStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    touchLongPressTimerRef.current = setTimeout(() => {
      setTouchDragItemId(itemId);
    }, 220);
  };

  const handleTouchHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;

    const pointerState = touchPointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;

    if (!touchDragItemId) {
      const touchStart = touchStartRef.current;

      if (touchStart) {
        const deltaX = Math.abs(event.clientX - touchStart.x);
        const deltaY = Math.abs(event.clientY - touchStart.y);

        if (deltaX > 10 || deltaY > 10) {
          clearTouchDragState();
        }
      }

      return;
    }

    event.preventDefault();

    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-reorder-id]");
    const targetId = targetElement?.dataset.reorderId;

    if (!targetId || targetId === touchDragItemId) return;

    setCardEvents((prev) => {
      const fromIndex = prev.findIndex((item) => getCardEventIdentityKey(item) === touchDragItemId);
      const toIndex = prev.findIndex((item) => getCardEventIdentityKey(item) === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return prev;
      }

      return moveItem(prev, fromIndex, toIndex);
    });
  };

  const handleTouchHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    clearTouchDragState();
  };

  if (shouldRenderLockedPreview) {
    const lockedCard = lockedCardEvents.length > 0 ? lockedCardEvents : cardEvents;

    return (
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {isPermanentlyLocked ? "Your card is locked" : "Card accepted"}
          </h2>
          <p className="text-sm text-slate-500">
            {isPermanentlyLocked
              ? "You're live — scoring has started"
              : "Card locked. You can still edit before game starts"}
          </p>
          {(acceptFeedback || generateState.success) && (
            <p className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {acceptFeedback ??
                (isPermanentlyLocked
                  ? "You're live — scoring has started"
                  : "Card locked. You can still edit before game starts")}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-white/90 p-4 shadow-sm">
          {showPostLockSignInPrompt && !isAuthenticatedUser && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Save your game</p>
              <p className="mt-1 text-xs text-slate-600">
                Sign in so it&apos;s easier to come back to this game later.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AuthDialog
                  label="Sign in"
                  nextPath={`/g/${slug}/play`}
                  linkPlayerId={playerId ?? undefined}
                  emphasis="prominent"
                />
                <button
                  type="button"
                  onClick={() => setShowPostLockSignInPrompt(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Continue without signing in
                </button>
              </div>
            </section>
          )}

          {mode === "streak" ? (
            <>
              <p className="text-sm font-medium text-slate-600">Streak order</p>
              <div className="rounded-2xl bg-white/90 shadow-sm">
                <ul className="divide-y divide-slate-200">
                  {lockedCard.map((event, index) => {
                    const tone = getIdentityTone(event.cardTeamKey ?? null);
                    const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;
                    const threshold = typeof event.threshold === "number" ? event.threshold : 1;
                    const requiredCount =
                      typeof event.required_count === "number"
                        ? event.required_count
                        : getRequiredCountForThresholdLevel(event, sportProfile, threshold);
                    const isCompleted = Boolean(event.is_completed ?? event.marked);
                    const currentCount =
                      typeof event.current_count === "number"
                        ? event.current_count
                        : isCompleted
                          ? requiredCount
                          : 0;

                    return (
                      <li
                        key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container} ${
                          isCompleted ? "ring-1 ring-blue-300" : ""
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {index + 1}. {formatThresholdEventLabel(requiredCount, stripTeamPrefix(event.label, teamName))}
                          </p>
                          {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                          <p className="text-xs text-slate-500">{getEventPointsForProfile(event, sportProfile)} pts</p>
                        </div>
                        <p className={isCompleted ? "text-xs font-semibold text-blue-600" : "text-xs text-slate-500"}>
                          {isCompleted ? "Complete" : formatProgressCount(currentCount, requiredCount)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Compact preview</p>
              <div className="space-y-2 text-sm text-slate-700">
                {lockedCard.map((event, index) => (
                  (() => {
                    const tone = getIdentityTone(event.cardTeamKey ?? null);
                    const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;
                    const threshold = typeof event.threshold === "number" ? event.threshold : 1;
                    const requiredCount =
                      typeof event.required_count === "number"
                        ? event.required_count
                        : getRequiredCountForThresholdLevel(event, sportProfile, threshold);
                    const isCompleted = Boolean(event.is_completed ?? event.marked);
                    const currentCount =
                      typeof event.current_count === "number"
                        ? event.current_count
                        : isCompleted
                          ? requiredCount
                          : 0;

                    return (
                  <div
                    key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                    className={`rounded-lg px-3 py-2 ${tone.container} ${
                      isCompleted ? "ring-1 ring-blue-300" : ""
                    }`}
                  >
                    <p className="font-medium text-slate-900">
                      {formatThresholdEventLabel(requiredCount, stripTeamPrefix(event.label, teamName))}
                    </p>
                    {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{getEventPointsForProfile(event, sportProfile)} pts</span>
                      <span className={isCompleted ? "font-semibold text-blue-600" : "text-slate-500"}>
                        {isCompleted ? "Complete" : formatProgressCount(currentCount, requiredCount)}
                      </span>
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            </>
          )}
        </div>

        {!isPermanentlyLocked && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  editAction();
                });
              }}
              disabled={isEditSubmitting}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEditSubmitting ? "Unlocking..." : "Edit card"}
            </button>
          </div>
        )}

        {editState.error && (
          <p className="mt-3 text-xs text-red-600">{editState.error}</p>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next step</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{onboardingHeadline}</h2>
      </section>

      <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Builder</p>
          <h2 className="text-2xl font-semibold text-slate-900">Make your picks</h2>
          <p className="text-xs text-slate-600">
            {mode === "streak" ? "Streak order" : "Blackout"} • Risk {riskLevel}/5 • {cardTotalPoints} pts
          </p>
        </div>

        <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Risk</p>
            <p className="text-base font-semibold text-slate-800">{riskLevel} / 5</p>
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Card points</p>
            <p className="text-base font-semibold text-slate-800">{cardTotalPoints} pts</p>
            <p className="text-[11px] text-slate-500">{cardRiskLabel}</p>
          </div>
        </div>

        <div className="sticky top-3 z-20 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your picks</p>
            {mode === "streak" && (
              <p className="text-xs uppercase tracking-wide text-slate-500">Drag to reorder</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className={`text-xs font-semibold ${isCardReadyToAccept ? "text-emerald-700" : "text-slate-600"}`}>
              {isCardReadyToAccept ? `${picksProgressLabel} ✓` : picksProgressLabel}
            </p>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoBuildClick}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Auto-build
            </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">Choose 5 events to build your Bingra card.</p>
        </div>

        {mode === "streak" ? (
          <div>
            <div className="mt-3 rounded-2xl bg-white/90 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Streak order</p>
            </div>
            <ul className="divide-y divide-slate-200">
              {visibleCardSlots.map((event, index) => {
                if (!event) {
                  return (
                    <li
                      key={`placeholder-streak-${index}`}
                      className="flex items-center justify-between gap-3 border border-slate-200 border-l-4 border-l-slate-300 border-dashed bg-slate-50/80 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-400">{index + 1}. Choose an event</p>
                        <p className="text-xs text-slate-400">Slot {index + 1} of 5</p>
                      </div>
                    </li>
                  );
                }

                const itemId = getCardEventIdentityKey(event);
                const tone = getIdentityTone(event.cardTeamKey ?? null);
                const isTouchDragging = touchDragItemId === itemId;
                const requiredCount =
                  typeof event.required_count === "number"
                    ? event.required_count
                    : getRequiredCountForThresholdLevel(event, sportProfile, event.threshold);

                return (
                  <li
                    key={`${event.id}-${event.cardTeamKey ?? "NONE"}-reorder`}
                    data-reorder-id={itemId}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container} ${
                      isTouchDragging ? "opacity-70" : ""
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {index + 1}. {formatThresholdEventLabel(
                          requiredCount,
                          stripTeamPrefix(event.label, event.cardTeamKey ? teamNames[event.cardTeamKey] : null),
                        )}
                      </p>
                      {event.cardTeamKey && (
                        <p className="text-[11px] text-slate-500">{teamNames[event.cardTeamKey]}</p>
                      )}
                      <p className="text-xs text-slate-500">{getThresholdPreviewPoints(event, sportProfile)} pts</p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 touch-none items-center justify-center rounded-2xl bg-white/90 text-base font-semibold text-slate-500 shadow-sm"
                        aria-label={`Drag to reorder ${event.label}`}
                        title="Long press then drag to reorder"
                        onPointerDown={(pointerEvent) =>
                          handleTouchHandlePointerDown(pointerEvent, itemId)
                        }
                        onPointerMove={handleTouchHandlePointerMove}
                        onPointerUp={handleTouchHandlePointerUp}
                        onPointerCancel={handleTouchHandlePointerUp}
                      >
                        ≡
                      </button>
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
              })}
            </ul>
          </div>
          </div>
        ) : (
          <div>
            <div className="mx-auto mt-3 max-w-2xl rounded-2xl bg-white/90 shadow-sm">
              <ul className="divide-y divide-slate-200">
                {visibleCardSlots.map((event, index) => {
                  if (!event) {
                    return (
                      <li
                        key={`placeholder-blackout-${index}`}
                        className="flex items-start justify-between gap-3 border border-slate-200 border-l-4 border-l-slate-300 border-dashed bg-slate-50/80 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-400">Choose an event</p>
                          <p className="text-xs text-slate-400">Slot {index + 1} of 5</p>
                        </div>
                      </li>
                    );
                  }

                  const tone = getIdentityTone(event.cardTeamKey ?? null);
                  const teamName = event.cardTeamKey ? teamNames[event.cardTeamKey] : null;
                const requiredCount =
                  typeof event.required_count === "number"
                    ? event.required_count
                    : getRequiredCountForThresholdLevel(event, sportProfile, event.threshold);

                  return (
                    <li
                      key={`${event.id}-${event.cardTeamKey ?? "NONE"}-${index}`}
                      className={`flex items-start justify-between gap-3 px-4 py-3 text-sm text-slate-700 ${tone.container}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {formatThresholdEventLabel(requiredCount, stripTeamPrefix(event.label, teamName))}
                        </p>
                        {teamName && <p className="text-[11px] text-slate-500">{teamName}</p>}
                        <p className="text-xs text-slate-500">{getThresholdPreviewPoints(event, sportProfile)} pts</p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Events</p>
              <p className="text-xs text-slate-500">
                {isCardReadyToAccept
                  ? "Card is full. Remove a pick to add another."
                  : `${missingEventsCount} more pick${missingEventsCount === 1 ? "" : "s"} needed to lock your card.`}
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              {cardEvents.length}/{eventsPerCard}
            </p>
            {isCardReadyToAccept && (
              <button
                type="button"
                onClick={() => setIsEventListExpanded((prev) => !prev)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {isEventListExpanded ? "Hide picks" : "Edit picks"}
              </button>
            )}
          </div>

          {shouldShowEventList && (
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
                      {events.map((candidate) => {
                        const alreadyOnCard = selectedIdentityKeys.has(candidate.identityKey);
                        const isDisabled = !alreadyOnCard && !canAddMoreEvents;
                        const toneClass = getIdentityTone(candidate.cardTeamKey);
                        const identityKey = getAddableEventIdentityKey(candidate);
                        const isExpanded = expandedAddEventIdentityKeys.has(identityKey);
                        const maxThreshold = getEventMaxThreshold(candidate.event);
                        const thresholdOptions = Array.from({ length: maxThreshold }, (_, idx) => idx + 1);

                        return (
                          <li
                            key={candidate.identityKey}
                            className={`rounded-xl p-3 ${toneClass.container}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">{candidate.eventName}</p>
                                {candidate.teamName && (
                                  <p className="text-[11px] text-slate-500">{candidate.teamName}</p>
                                )}
                                <p className="text-xs text-slate-500">{candidate.basePoints} pts</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleAddableEvent(candidate)}
                                disabled={isDisabled}
                                className={`rounded-2xl px-3 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                                  alreadyOnCard
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-white/90 text-slate-700"
                                }`}
                              >
                                {alreadyOnCard ? "✓ Added" : isExpanded ? "Cancel" : "Choose"}
                              </button>
                            </div>

                            {!alreadyOnCard && isExpanded && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Choose threshold
                                </p>
                                {thresholdOptions.map((threshold) => {
                                  const requiredCount = getRequiredCountForThresholdLevel(
                                    candidate.event,
                                    sportProfile,
                                    threshold,
                                  );
                                  const thresholdPoints = Math.round(
                                    candidate.basePoints * getThresholdScoreMultiplier(threshold),
                                  );

                                  return (
                                    <button
                                      key={`${identityKey}-threshold-${threshold}`}
                                      type="button"
                                      onClick={() => handleAddEventWithThreshold(candidate, threshold)}
                                      disabled={!canAddMoreEvents}
                                      className="rounded-2xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50"
                                    >
                                      {requiredCount}+ · {thresholdPoints} pts
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => handleCollapseAddableEvent(identityKey)}
                                  className="rounded-2xl px-2.5 py-1 text-xs font-semibold text-slate-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
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

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-slate-500">Lock your card to start scoring.</p>
        <button
          type="button"
          onClick={handleAcceptCard}
          className="rounded-2xl bg-[#2f6df6] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#295fda] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6df6]"
          disabled={!isHydrated || isSubmitting || !playerId || !isCardReadyToAccept}
        >
          {isSubmitting ? "Locking..." : "Lock My Card"}
        </button>
      </div>

      {showAutoBuildSuccess && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">Your card is ready</p>
          <p className="mt-1 text-xs text-emerald-800">You can customize it or lock it now.</p>
        </section>
      )}

      {!isCardReadyToAccept && (
        <p className="mt-2 text-xs text-amber-700">
          Add {missingEventsCount} more pick{missingEventsCount === 1 ? "" : "s"} before locking your card.
        </p>
      )}
      {!playerId && isHydrated && (
        <p className="mt-2 text-xs text-amber-700" role="alert">
          You need to join this game before you can lock a card.
        </p>
      )}
      {(acceptActionError || generateState.error) && (
        <p className="mt-3 text-xs text-red-600">{acceptActionError ?? generateState.error}</p>
      )}
      {editState.error && (
        <p className="mt-3 text-xs text-red-600">{editState.error}</p>
      )}
      </div>

      </section>
    </>
  );
}
