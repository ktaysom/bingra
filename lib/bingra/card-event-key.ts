import type { TeamKey } from "./event-logic";

export type QualifiedCardEventKey = {
  baseEventKey: string | null;
  qualifiedTeamKey: TeamKey | null;
};

type EventWithTeam = {
  eventKey: string | null | undefined;
  teamKey?: string | null | undefined;
};

const QUALIFIED_EVENT_KEY_SEPARATOR = ":";

const SOCCER_ANY_GOAL_MATCH_KEYS = new Set<string>([
  "ANY_GOAL",
  "SHOT_ON_GOAL_GOAL",
  "SHOT_ON_GOAL_GOAL_OFF_REBOUND",
  "SHOT_ON_GOAL_ASSISTED_GOAL",
]);

function matchesBaseEventKey(cardBaseEventKey: string, recordedBaseEventKey: string): boolean {
  if (cardBaseEventKey === "ANY_GOAL") {
    return SOCCER_ANY_GOAL_MATCH_KEYS.has(recordedBaseEventKey);
  }

  return cardBaseEventKey === recordedBaseEventKey;
}

export function buildCardCellEventKey(
  baseEventKey: string,
  teamKey: TeamKey | null | undefined,
): string {
  if (!teamKey) {
    return baseEventKey;
  }

  return `${baseEventKey}${QUALIFIED_EVENT_KEY_SEPARATOR}${teamKey}`;
}

export function parseCardEventKey(eventKey: string | null | undefined): QualifiedCardEventKey {
  if (!eventKey) {
    return {
      baseEventKey: null,
      qualifiedTeamKey: null,
    };
  }

  const separatorIndex = eventKey.lastIndexOf(QUALIFIED_EVENT_KEY_SEPARATOR);

  if (separatorIndex <= 0) {
    return {
      baseEventKey: eventKey,
      qualifiedTeamKey: null,
    };
  }

  const suffix = eventKey.slice(separatorIndex + 1);
  const parsedTeamKey = suffix === "A" || suffix === "B" ? suffix : null;

  if (!parsedTeamKey) {
    return {
      baseEventKey: eventKey,
      qualifiedTeamKey: null,
    };
  }

  return {
    baseEventKey: eventKey.slice(0, separatorIndex),
    qualifiedTeamKey: parsedTeamKey,
  };
}

export function parseCardCellEventKey(eventKey: string | null | undefined): QualifiedCardEventKey {
  return parseCardEventKey(eventKey);
}

export function resolveBaseEventKey(eventKey: string | null | undefined): string | null {
  return parseCardCellEventKey(eventKey).baseEventKey;
}

export function resolveEffectiveTeamKey(input: EventWithTeam): TeamKey | null {
  const parsed = parseCardCellEventKey(input.eventKey);
  if (parsed.qualifiedTeamKey) {
    return parsed.qualifiedTeamKey;
  }

  return input.teamKey === "A" || input.teamKey === "B" ? input.teamKey : null;
}

export function cardCellEventMatchesRecordedEvent(input: {
  cardCell: EventWithTeam;
  recordedEvent: EventWithTeam;
}): boolean {
  const cardBaseEventKey = resolveBaseEventKey(input.cardCell.eventKey);
  const recordedBaseEventKey = resolveBaseEventKey(input.recordedEvent.eventKey);

  if (!cardBaseEventKey || !recordedBaseEventKey) {
    return false;
  }

  if (!matchesBaseEventKey(cardBaseEventKey, recordedBaseEventKey)) {
    return false;
  }

  const expectedTeamKey = resolveEffectiveTeamKey(input.cardCell);
  if (!expectedTeamKey) {
    return true;
  }

  return resolveEffectiveTeamKey(input.recordedEvent) === expectedTeamKey;
}

export function assertUniqueCardCellEventKeys(eventKeys: string[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const eventKey of eventKeys) {
    if (seen.has(eventKey)) {
      duplicates.add(eventKey);
      continue;
    }

    seen.add(eventKey);
  }

  if (duplicates.size > 0) {
    const duplicateArray = Array.from(duplicates);
    const joinFn = duplicateArray.join;
    console.info("[card-event-key][join-check] duplicateArray", {
      context: "assertUniqueCardCellEventKeys",
      variable: "duplicateArray",
      isArray: Array.isArray(duplicateArray),
      type: typeof duplicateArray,
      hasCallableJoin: typeof joinFn === "function",
    });
    const duplicateList =
      typeof joinFn === "function"
        ? joinFn.call(duplicateArray, ", ")
        : duplicateArray[0] ?? "unknown";

    throw new Error(
      `Duplicate card cell event keys are not allowed: ${duplicateList}`,
    );
  }
}