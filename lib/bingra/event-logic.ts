import {
  EVENT_CATALOG,
  type GameEventType,
  type GameMode,
  type ScorerParentCategory,
  type ScorerSubtypeGroup,
} from "./event-catalog";
import {
  DEFAULT_SPORT_PROFILE,
  getSportProfileDefinition,
  type SportProfileKey,
} from "./sport-profiles";

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

const SCORER_PARENT_OPTION_IDS: ScorerParentCategory[] = [
  "change-of-possession",
  "score",
  "misc",
];

const SCORER_SUBTYPE_FLOW_LABELS: Partial<Record<ScorerSubtypeGroup, string>> = {
  "free-throw": "Made free throw",
  "soccer-shot-on-goal": "Shot on goal",
  "soccer-out-of-bounds": "Out of bounds",
};

function getScorerParentLabel(
  parent: ScorerParentCategory,
  profile: SportProfileKey,
): string {
  if (parent === "change-of-possession") {
    return "Change of possession";
  }

  if (parent === "score") {
    return "Score";
  }

  const sport = getSportProfileDefinition(profile).sport;
  return sport === "basketball" ? "Time Out" : "Misc";
}

export function isEventEnabledForProfile(
  event: GameEventType,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): boolean {
  if (!event.enabledProfiles || event.enabledProfiles.length === 0) {
    return true;
  }

  return event.enabledProfiles.includes(profile);
}

export function getEventPointsForProfile(
  event: GameEventType,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): number {
  return event.scoringByProfile[profile] ?? 0;
}

export function getEventRarityForProfile(
  event: GameEventType,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): 1 | 2 | 3 | 4 | 5 {
  return event.rarityByProfile[profile] ?? 3;
}

export function getEventMaxThreshold(event: GameEventType): number {
  return typeof event.maxThreshold === "number" ? event.maxThreshold : 5;
}

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

export function getEventsForMode(mode: GameMode, profile?: SportProfileKey): GameEventType[] {
  return getEnabledEvents().filter(
    (event) =>
      event.allowedModes.includes(mode) &&
      isEventEnabledForProfile(event, profile ?? DEFAULT_SPORT_PROFILE),
  );
}

export function getTeamScopedEvents(mode?: GameMode, profile?: SportProfileKey): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));
  return events.filter((event) => event.teamScope === "team");
}

export function getGameScopedEvents(mode?: GameMode, profile?: SportProfileKey): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));
  return events.filter((event) => event.teamScope === "none");
}

export function getEventsByCategory(
  category: GameEventType["category"],
  mode?: GameMode,
  profile?: SportProfileKey,
): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));
  return events.filter((event) => event.category === category);
}

export function getEventsForRiskLevel(
  riskLevel: RiskLevel,
  mode?: GameMode,
  profile?: SportProfileKey,
): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));

  return events.filter((event) => {
    const rarity = getEventRarityForProfile(event, profile);
    const distance = Math.abs(rarity - riskLevel);
    return distance <= 1;
  });
}

export function filterEventsByRiskBias(
  events: GameEventType[],
  riskLevel: RiskLevel,
  profile?: SportProfileKey,
): GameEventType[] {
  const filtered = events.filter(
    (event) => Math.abs(getEventRarityForProfile(event, profile) - riskLevel) <= 1,
  );
  return filtered.length > 0 ? filtered : events;
}

export function getWeightedEventsForRiskLevel(
  riskLevel: RiskLevel,
  mode?: GameMode,
  profile?: SportProfileKey,
): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));
  const weighted: GameEventType[] = [];

  for (const event of events) {
    const rarity = getEventRarityForProfile(event, profile);
    const distance = Math.abs(rarity - riskLevel);

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
  return events.reduce(
    (sum, event) => sum + getEventPointsForProfile(event, DEFAULT_SPORT_PROFILE),
    0,
  );
}

export function summarizeCardPoints(
  events: GameEventType[],
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): CardPointSummary {
  const totalBasePoints = events.reduce(
    (sum, event) => sum + getEventPointsForProfile(event, profile),
    0,
  );
  const averageBasePoints = events.length > 0 ? totalBasePoints / events.length : 0;
  const rarityScore =
    events.length > 0
      ? events.reduce((sum, event) => sum + getEventRarityForProfile(event, profile), 0) /
        events.length
      : 0;

  return {
    totalBasePoints,
    averageBasePoints,
    rarityScore,
  };
}

export function sortEventsForDisplay(
  events: GameEventType[],
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): GameEventType[] {
  return [...events].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }

    const pointsA = getEventPointsForProfile(a, profile);
    const pointsB = getEventPointsForProfile(b, profile);

    if (pointsA !== pointsB) {
      return pointsA - pointsB;
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
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): HostRenderableEvent[] {
  const events = sortEventsForDisplay(
    mode
      ? getEventsForMode(mode, profile)
      : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile)),
    profile,
  );
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
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): Record<string, HostRenderableEvent[]> {
  const renderable = getHostRenderableEvents(mode, teamNames, profile);

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
  profile?: SportProfileKey;
}): { valid: true; event: GameEventType } | { valid: false; reason: string } {
  const event = getEventById(input.eventId);

  if (!event) {
    return {
      valid: false,
      reason: `Unknown event id: ${input.eventId}`,
    };
  }

  const team = input.team ?? null;

  if (!isEventEnabledForProfile(event, input.profile ?? DEFAULT_SPORT_PROFILE)) {
    return {
      valid: false,
      reason: `Event ${input.eventId} is not enabled for this game profile`,
    };
  }

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
    profile?: SportProfileKey;
  },
): GameEventType[] {
  const mode = options?.mode;
  const riskLevel = options?.riskLevel ?? 3;
  const uniqueByEventId = options?.uniqueByEventId ?? true;
  const includeGameScopedEvents = options?.includeGameScopedEvents ?? true;
  const profile = options?.profile ?? DEFAULT_SPORT_PROFILE;

  let pool = getWeightedEventsForRiskLevel(riskLevel, mode, profile);

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

export function estimateCardRiskLabel(
  events: GameEventType[],
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): string {
  const summary = summarizeCardPoints(events, profile);

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

export function getScorerEnabledEvents(
  mode?: GameMode,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): GameEventType[] {
  const events = mode
    ? getEventsForMode(mode, profile)
    : getEnabledEvents().filter((event) => isEventEnabledForProfile(event, profile));

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
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): ScorerParentOption[] {
  const events = getScorerEnabledEvents(mode, profile);
  const availableParents = new Set(
    events
      .map((event) => event.scorerParentCategory)
      .filter((value): value is ScorerParentCategory => Boolean(value)),
  );

  return SCORER_PARENT_OPTION_IDS
    .filter((parentId) => availableParents.has(parentId))
    .map((parentId) => ({
      id: parentId,
      label: getScorerParentLabel(parentId, profile),
    }));
}

export function getScorerEventsForParent(
  parent: ScorerParentCategory,
  mode?: GameMode,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): Array<{
  id: string;
  label: string;
  subtypeGroup?: ScorerSubtypeGroup;
}> {
  const scorerEvents = getScorerEnabledEvents(mode, profile);
  const parentEvents = scorerEvents.filter(
    (event) => event.scorerParentCategory === parent,
  );

  const directEventOptions = parentEvents
    .filter((event) => (event.scorerSubtypeGroup ?? "none") === "none")
    .map((event) => ({
      id: event.id,
      label: event.label,
      subtypeGroup: event.scorerSubtypeGroup,
      order: event.scorerOrder ?? 999,
    }));

  const subtypeFlowOptions = Object.entries(
    parentEvents.reduce<Partial<Record<ScorerSubtypeGroup, number>>>((acc, event) => {
      const subgroup = event.scorerSubtypeGroup ?? "none";

      if (subgroup === "none") {
        return acc;
      }

      const order = event.scorerOrder ?? 999;
      const existing = acc[subgroup];

      if (existing === undefined || order < existing) {
        acc[subgroup] = order;
      }

      return acc;
    }, {}),
  )
    .filter(([subgroup]) => subgroup !== "none")
    .map(([subgroup, order]) => ({
      id: `${subgroup.toUpperCase().replace(/-/g, "_")}_FLOW`,
      label: SCORER_SUBTYPE_FLOW_LABELS[subgroup as ScorerSubtypeGroup] ?? subgroup,
      subtypeGroup: subgroup as ScorerSubtypeGroup,
      order: order ?? 999,
    }));

  return [...directEventOptions, ...subtypeFlowOptions]
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.label.localeCompare(b.label);
    })
    .map(({ id, label, subtypeGroup }) => ({ id, label, subtypeGroup }));
}

export function getScorerSubtypeOptions(
  subtypeGroup: ScorerSubtypeGroup,
  mode?: GameMode,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): ScorerSubtypeOption[] {
  if (subtypeGroup === "none") {
    return [];
  }

  const scorerEvents = getScorerEnabledEvents(mode, profile);

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
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): ScorerEventOption[] {
  const scorerEvents = getScorerEnabledEvents(mode, profile);

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
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): ScorerEventOption | undefined {
  const event = (
    mode
      ? getEventsForMode(mode, profile)
      : getEnabledEvents().filter((item) => isEventEnabledForProfile(item, profile))
  ).find(
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

export function eventRequiresTeam(
  eventId: string,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): boolean {
  const event = getEventById(eventId);
  if (!event || !isEventEnabledForProfile(event, profile)) {
    return false;
  }

  return event?.teamScope === "team";
}