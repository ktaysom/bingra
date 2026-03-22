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

  if (cardBaseEventKey !== recordedBaseEventKey) {
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
    throw new Error(
      `Duplicate card cell event keys are not allowed: ${Array.from(duplicates).join(", ")}`,
    );
  }
}