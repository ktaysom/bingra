import {
  EVENT_CATALOG,
  type GameEventType,
  type GameMode,
  type ScorerParentCategory,
  type ScorerSubtypeGroup,
} from "./event-catalog";

export type TeamKey = "A" | "B";
export type TeamSelection = TeamKey | null;

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type HostRenderableEvent = {
  event: GameEventType;
  team: TeamSelection;
  hostLabel: string;
  hostKey: string;
};

export type CardPointSummary = {
  totalBasePoints: number;
  averageBasePoints: number;
  rarityScore: number;
};

export type ScorerParentOption = {
  id: ScorerParentCategory;
  label: string;
};

export type ScorerEventOption = {
  id: string;
  label: string;
  shortLabel: string;
  requiresTeam: boolean;
  teamScope: GameEventType["teamScope"];
  teamRole: GameEventType["teamRole"];
  parentCategory: ScorerParentCategory;
  subtypeGroup: ScorerSubtypeGroup;
  order: number;
  event: GameEventType;
};

export type ScorerSubtypeOption = {
  id: string;
  label: string;
  shortLabel: string;
  requiresTeam: boolean;
  teamScope: GameEventType["teamScope"];
  teamRole: GameEventType["teamRole"];
  parentCategory: ScorerParentCategory;
  subtypeGroup: ScorerSubtypeGroup;
  order: number;
  event: GameEventType;
};

const SCORER_PARENT_OPTIONS: ScorerParentOption[] = [
  { id: "change-of-possession", label: "Change of possession" },
  { id: "score", label: "Score" },
];

const SCORER_PARENT_EVENT_LABELS: Record<
  ScorerParentCategory,
  Array<{ id: string; label: string; subtypeGroup?: ScorerSubtypeGroup }>
> = {
  "change-of-possession": [
    { id: "STEAL", label: "Steal" },
    { id: "CHARGE_TAKEN", label: "Charge" },
    { id: "JUMP_BALL_CALL", label: "Jump ball" },
    { id: "TRAVEL", label: "Travel" },
    { id: "DOUBLE_DRIBBLE", label: "Double dribble" },
    { id: "ILLEGAL_SCREEN", label: "Illegal screen" },
    { id: "THREE_SECOND_CALL", label: "3-second call" },
    { id: "FIVE_SECOND_CALL", label: "5-second call" },
    { id: "OVER_AND_BACK", label: "Over and back" },
  ],
  score: [
    { id: "FREE_THROW_FLOW", label: "Made free throw", subtypeGroup: "free-throw" },
    { id: "DUNK", label: "Dunk" },
    { id: "THREE_POINTER_MADE", label: "3-pointer made" },
  ],
};

export function getEnabledEvents(): GameEventType[] {
  return EVENT_CATALOG.filter((event) => event.enabled);
}

export function getEventById(eventId: string): GameEventType | undefined {
  return EVENT_CATALOG.find((event) => event.id === eventId);
}

export function requireEventById(eventId: string): GameEventType {
  const event = getEventById(eventId);

  if (!event) {
    throw new Error(`Unknown event id: ${eventId}`);
  }

  return event;
}

export function getEventsForMode(mode: GameMode): GameEventType[] {
  return getEnabledEvents().filter((event) => event.allowedModes.includes(mode));
}

export function getTeamScopedEvents(mode?: GameMode): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();
  return events.filter((event) => event.teamScope === "team");
}

export function getGameScopedEvents(mode?: GameMode): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();
  return events.filter((event) => event.teamScope === "none");
}

export function getEventsByCategory(
  category: GameEventType["category"],
  mode?: GameMode,
): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();
  return events.filter((event) => event.category === category);
}

export function getEventsForRiskLevel(
  riskLevel: RiskLevel,
  mode?: GameMode,
): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();

  return events.filter((event) => {
    const distance = Math.abs(event.rarity - riskLevel);
    return distance <= 1;
  });
}

export function filterEventsByRiskBias(
  events: GameEventType[],
  riskLevel: RiskLevel,
): GameEventType[] {
  const filtered = events.filter((event) => Math.abs(event.rarity - riskLevel) <= 1);
  return filtered.length > 0 ? filtered : events;
}

export function getWeightedEventsForRiskLevel(
  riskLevel: RiskLevel,
  mode?: GameMode,
): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();
  const weighted: GameEventType[] = [];

  for (const event of events) {
    const distance = Math.abs(event.rarity - riskLevel);

    let copies = 1;
    if (distance === 0) copies = 5;
    else if (distance === 1) copies = 3;
    else if (distance === 2) copies = 1;
    else copies = 0;

    for (let i = 0; i < copies; i += 1) {
      weighted.push(event);
    }
  }

  return weighted.length > 0 ? weighted : events;
}

export function calculateCardPointValue(events: GameEventType[]): number {
  return events.reduce((sum, event) => sum + event.basePoints, 0);
}

export function summarizeCardPoints(events: GameEventType[]): CardPointSummary {
  const totalBasePoints = calculateCardPointValue(events);
  const averageBasePoints = events.length > 0 ? totalBasePoints / events.length : 0;
  const rarityScore =
    events.length > 0
      ? events.reduce((sum, event) => sum + event.rarity, 0) / events.length
      : 0;

  return {
    totalBasePoints,
    averageBasePoints,
    rarityScore,
  };
}

export function sortEventsForDisplay(events: GameEventType[]): GameEventType[] {
  return [...events].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }

    if (a.basePoints !== b.basePoints) {
      return a.basePoints - b.basePoints;
    }

    return a.label.localeCompare(b.label);
  });
}

export function getTeamRoleLabel(event: GameEventType): string {
  switch (event.teamRole) {
    case "offense":
      return "Offense";
    case "defense":
      return "Defense";
    case "either":
      return "Either";
    case "none":
    default:
      return "Game";
  }
}

export function buildHostLabel(
  event: GameEventType,
  options?: {
    team?: TeamSelection;
    teamNames?: Partial<Record<TeamKey, string>>;
    includeRolePrefix?: boolean;
  },
): string {
  const team = options?.team ?? null;
  const includeRolePrefix = options?.includeRolePrefix ?? false;

  const teamName =
    team != null
      ? options?.teamNames?.[team] || `Team ${team}`
      : null;

  const rolePrefix =
    includeRolePrefix && event.teamRole !== "none"
      ? `${getTeamRoleLabel(event)} • `
      : "";

  if (event.teamScope === "team" && teamName) {
    return `${rolePrefix}${teamName} ${event.shortLabel}`;
  }

  return `${rolePrefix}${event.label}`;
}

export function getHostRenderableEvents(
  mode?: GameMode,
  teamNames?: Partial<Record<TeamKey, string>>,
): HostRenderableEvent[] {
  const events = sortEventsForDisplay(mode ? getEventsForMode(mode) : getEnabledEvents());
  const renderable: HostRenderableEvent[] = [];

  for (const event of events) {
    if (event.teamScope === "team") {
      for (const team of ["A", "B"] as const) {
        renderable.push({
          event,
          team,
          hostLabel: buildHostLabel(event, { team, teamNames }),
          hostKey: `${event.id}:${team}`,
        });
      }
    } else {
      renderable.push({
        event,
        team: null,
        hostLabel: buildHostLabel(event, { team: null, teamNames }),
        hostKey: `${event.id}:GAME`,
      });
    }
  }

  return renderable;
}

export function getHostEventGroups(
  mode?: GameMode,
  teamNames?: Partial<Record<TeamKey, string>>,
): Record<string, HostRenderableEvent[]> {
  const renderable = getHostRenderableEvents(mode, teamNames);

  return renderable.reduce<Record<string, HostRenderableEvent[]>>((groups, item) => {
    const key = item.event.category;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
    return groups;
  }, {});
}

export function isEventAllowedForTeam(
  event: GameEventType,
  team: TeamSelection,
  options?: {
    allowTeamWildcardForTeamScoped?: boolean;
  },
): boolean {
  if (event.teamScope === "none") {
    return team === null;
  }

  if (options?.allowTeamWildcardForTeamScoped && team === null) {
    return true;
  }

  return team === "A" || team === "B";
}

export function validateRecordedEvent(input: {
  eventId: string;
  team?: TeamSelection;
  allowTeamWildcardForTeamScoped?: boolean;
}): { valid: true; event: GameEventType } | { valid: false; reason: string } {
  const event = getEventById(input.eventId);

  if (!event) {
    return {
      valid: false,
      reason: `Unknown event id: ${input.eventId}`,
    };
  }

  const team = input.team ?? null;

  if (
    !isEventAllowedForTeam(event, team, {
      allowTeamWildcardForTeamScoped: input.allowTeamWildcardForTeamScoped,
    })
  ) {
    return {
      valid: false,
      reason: `Event ${input.eventId} has invalid team assignment`,
    };
  }

  return {
    valid: true,
    event,
  };
}

export function chooseRandomEvents(
  count: number,
  options?: {
    mode?: GameMode;
    riskLevel?: RiskLevel;
    uniqueByEventId?: boolean;
    includeGameScopedEvents?: boolean;
  },
): GameEventType[] {
  const mode = options?.mode;
  const riskLevel = options?.riskLevel ?? 3;
  const uniqueByEventId = options?.uniqueByEventId ?? true;
  const includeGameScopedEvents = options?.includeGameScopedEvents ?? true;

  let pool = getWeightedEventsForRiskLevel(riskLevel, mode);

  if (!includeGameScopedEvents) {
    pool = pool.filter((event) => event.teamScope === "team");
  }

  if (pool.length === 0 || count <= 0) {
    return [];
  }

  const chosen: GameEventType[] = [];
  const usedIds = new Set<string>();

  let safety = 0;
  while (chosen.length < count && safety < 500) {
    safety += 1;
    const event = pool[Math.floor(Math.random() * pool.length)];

    if (uniqueByEventId && usedIds.has(event.id)) {
      continue;
    }

    chosen.push(event);
    usedIds.add(event.id);
  }

  return chosen;
}

export function estimateCardRiskLabel(events: GameEventType[]): string {
  const summary = summarizeCardPoints(events);

  if (summary.rarityScore >= 4.25 || summary.averageBasePoints >= 75) {
    return "High Risk";
  }

  if (summary.rarityScore >= 3.25 || summary.averageBasePoints >= 50) {
    return "Medium Risk";
  }

  return "Low Risk";
}

/**
 * Scorer-flow helpers
 */

export function getScorerEnabledEvents(mode?: GameMode): GameEventType[] {
  const events = mode ? getEventsForMode(mode) : getEnabledEvents();

  return events
    .filter((event) => event.scorerEnabled)
    .sort((a, b) => {
      const parentCompare = (a.scorerParentCategory || "").localeCompare(
        b.scorerParentCategory || "",
      );

      if (parentCompare !== 0) return parentCompare;

      const orderA = a.scorerOrder ?? 999;
      const orderB = b.scorerOrder ?? 999;

      if (orderA !== orderB) return orderA - orderB;

      return a.label.localeCompare(b.label);
    });
}

export function getScorerParentOptions(
  mode?: GameMode,
): ScorerParentOption[] {
  const events = getScorerEnabledEvents(mode);
  const availableParents = new Set(
    events
      .map((event) => event.scorerParentCategory)
      .filter((value): value is ScorerParentCategory => Boolean(value)),
  );

  return SCORER_PARENT_OPTIONS.filter((option) => availableParents.has(option.id));
}

export function getScorerEventsForParent(
  parent: ScorerParentCategory,
  mode?: GameMode,
): Array<{
  id: string;
  label: string;
  subtypeGroup?: ScorerSubtypeGroup;
}> {
  const scorerEvents = getScorerEnabledEvents(mode);
  const parentEvents = scorerEvents.filter(
    (event) => event.scorerParentCategory === parent,
  );

  const availableEventIds = new Set(parentEvents.map((event) => event.id));
  const hasFreeThrowFlow = parentEvents.some(
    (event) => event.scorerSubtypeGroup === "free-throw",
  );

  return SCORER_PARENT_EVENT_LABELS[parent].filter((option) => {
    if (option.id === "FREE_THROW_FLOW") {
      return hasFreeThrowFlow;
    }

    return availableEventIds.has(option.id);
  });
}

export function getScorerSubtypeOptions(
  subtypeGroup: ScorerSubtypeGroup,
  mode?: GameMode,
): ScorerSubtypeOption[] {
  if (subtypeGroup === "none") {
    return [];
  }

  const scorerEvents = getScorerEnabledEvents(mode);

  return scorerEvents
    .filter((event) => event.scorerSubtypeGroup === subtypeGroup)
    .sort((a, b) => {
      const orderA = a.scorerOrder ?? 999;
      const orderB = b.scorerOrder ?? 999;

      if (orderA !== orderB) return orderA - orderB;

      return a.label.localeCompare(b.label);
    })
    .map((event) => ({
      id: event.id,
      label: event.label,
      shortLabel: event.shortLabel,
      requiresTeam: event.teamScope === "team",
      teamScope: event.teamScope,
      teamRole: event.teamRole,
      parentCategory: event.scorerParentCategory!,
      subtypeGroup: event.scorerSubtypeGroup ?? "none",
      order: event.scorerOrder ?? 999,
      event,
    }));
}

export function getScorerDirectEventOptions(
  parent: ScorerParentCategory,
  mode?: GameMode,
): ScorerEventOption[] {
  const scorerEvents = getScorerEnabledEvents(mode);

  return scorerEvents
    .filter(
      (event) =>
        event.scorerParentCategory === parent &&
        (event.scorerSubtypeGroup ?? "none") === "none",
    )
    .sort((a, b) => {
      const orderA = a.scorerOrder ?? 999;
      const orderB = b.scorerOrder ?? 999;

      if (orderA !== orderB) return orderA - orderB;

      return a.label.localeCompare(b.label);
    })
    .map((event) => ({
      id: event.id,
      label: event.label,
      shortLabel: event.shortLabel,
      requiresTeam: event.teamScope === "team",
      teamScope: event.teamScope,
      teamRole: event.teamRole,
      parentCategory: event.scorerParentCategory!,
      subtypeGroup: event.scorerSubtypeGroup ?? "none",
      order: event.scorerOrder ?? 999,
      event,
    }));
}

export function getScorerOptionById(
  eventId: string,
  mode?: GameMode,
): ScorerEventOption | undefined {
  const event = (mode ? getEventsForMode(mode) : getEnabledEvents()).find(
    (item) => item.id === eventId && item.scorerEnabled,
  );

  if (!event) {
    return undefined;
  }

  return {
    id: event.id,
    label: event.label,
    shortLabel: event.shortLabel,
    requiresTeam: event.teamScope === "team",
    teamScope: event.teamScope,
    teamRole: event.teamRole,
    parentCategory: event.scorerParentCategory!,
    subtypeGroup: event.scorerSubtypeGroup ?? "none",
    order: event.scorerOrder ?? 999,
    event,
  };
}

export function eventRequiresTeam(eventId: string): boolean {
  const event = getEventById(eventId);
  return event?.teamScope === "team";
}