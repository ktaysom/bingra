import type { GameEventType } from "./event-catalog";
import type { SportProfileKey } from "./sport-profiles";

export type ThresholdLevel = 1 | 2 | 3 | 4 | 5;

type RequiredCountMapByLevel = Partial<Record<ThresholdLevel, number>>;

type RequiredCountMapByEvent = Partial<
  Record<string, Partial<Record<SportProfileKey, RequiredCountMapByLevel>>>
>;

const THRESHOLD_LEVELS: ThresholdLevel[] = [1, 2, 3, 4, 5];

const BASKETBALL_COLLEGE_COUNTS: Partial<Record<string, RequiredCountMapByLevel>> = {
  MADE_FREE_THROW: { 1: 10, 2: 13, 3: 16, 4: 20, 5: 24 },
  THREE_POINTER_MADE: { 1: 6, 2: 8, 3: 10, 4: 12, 5: 14 },
  AND_ONE_CONVERTED: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  DUNK: { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 },
  TECHNICAL_FREE_THROW_MADE: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  BONUS_FREE_THROW_MADE: { 1: 1, 2: 2, 3: 3 },
  STEAL: { 1: 5, 2: 7, 3: 9, 4: 11, 5: 13 },
  BLOCK: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 },
  CHARGE_TAKEN: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  CARRY: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  TRAVEL: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 },
  DOUBLE_DRIBBLE: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  ILLEGAL_SCREEN: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  OUT_OF_BOUNDS: { 1: 3, 2: 5, 3: 7, 4: 9, 5: 11 },
  JUMP_BALL_CALL: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
  GOALTENDING: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  THREE_SECOND_CALL: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  FIVE_SECOND_CALL: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  OVER_AND_BACK: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  TIMEOUT_TAKEN: { 1: 1, 2: 2, 3: 3 },
  EIGHT_SECOND_VIOLATION: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  SHOT_CLOCK_VIOLATION: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
};

const BASKETBALL_PRO_COUNTS: Partial<Record<string, RequiredCountMapByLevel>> = {
  MADE_FREE_THROW: { 1: 12, 2: 15, 3: 18, 4: 22, 5: 26 },
  THREE_POINTER_MADE: { 1: 8, 2: 10, 3: 12, 4: 15, 5: 18 },
  AND_ONE_CONVERTED: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  DUNK: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 },
  TECHNICAL_FREE_THROW_MADE: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  BONUS_FREE_THROW_MADE: { 1: 1, 2: 2, 3: 3 },
  STEAL: { 1: 6, 2: 8, 3: 10, 4: 12, 5: 14 },
  BLOCK: { 1: 3, 2: 5, 3: 7, 4: 9, 5: 11 },
  CHARGE_TAKEN: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  CARRY: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  TRAVEL: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  DOUBLE_DRIBBLE: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  ILLEGAL_SCREEN: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  OUT_OF_BOUNDS: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 },
  JUMP_BALL_CALL: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
  GOALTENDING: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  THREE_SECOND_CALL: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  FIVE_SECOND_CALL: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  OVER_AND_BACK: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  TIMEOUT_TAKEN: { 1: 1, 2: 2, 3: 3 },
  EIGHT_SECOND_VIOLATION: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  SHOT_CLOCK_VIOLATION: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
};

const REQUIRED_COUNT_BY_THRESHOLD_LEVEL: RequiredCountMapByEvent = {};

for (const [eventId, counts] of Object.entries(BASKETBALL_COLLEGE_COUNTS)) {
  REQUIRED_COUNT_BY_THRESHOLD_LEVEL[eventId] = {
    ...(REQUIRED_COUNT_BY_THRESHOLD_LEVEL[eventId] ?? {}),
    basketball_college: counts,
  };
}

for (const [eventId, counts] of Object.entries(BASKETBALL_PRO_COUNTS)) {
  REQUIRED_COUNT_BY_THRESHOLD_LEVEL[eventId] = {
    ...(REQUIRED_COUNT_BY_THRESHOLD_LEVEL[eventId] ?? {}),
    basketball_pro: counts,
  };
}

function normalizeMaxThresholdLevel(event: GameEventType): ThresholdLevel {
  const raw = typeof event.maxThreshold === "number" ? event.maxThreshold : 5;
  const clamped = Math.min(5, Math.max(1, Math.ceil(Number.isFinite(raw) ? raw : 5)));
  return clamped as ThresholdLevel;
}

export function normalizeThresholdLevelForEvent(event: GameEventType, thresholdLevel: number): ThresholdLevel {
  const max = normalizeMaxThresholdLevel(event);
  const normalized = Number.isFinite(thresholdLevel) ? Math.ceil(thresholdLevel) : 1;
  const clamped = Math.min(max, Math.max(1, normalized));
  return clamped as ThresholdLevel;
}

export function getAllowedThresholdLevelsForEvent(
  event: GameEventType,
  _profile: SportProfileKey,
): ThresholdLevel[] {
  const max = normalizeMaxThresholdLevel(event);
  return THRESHOLD_LEVELS.filter((level) => level <= max);
}

export function getRequiredCountForThresholdLevel(
  event: GameEventType,
  profile: SportProfileKey,
  thresholdLevel: number,
): number {
  const normalizedLevel = normalizeThresholdLevelForEvent(event, thresholdLevel);
  const profileMap = REQUIRED_COUNT_BY_THRESHOLD_LEVEL[event.id]?.[profile];
  const mapped = profileMap?.[normalizedLevel];

  if (typeof mapped === "number" && Number.isFinite(mapped) && mapped > 0) {
    return Math.ceil(mapped);
  }

  return normalizedLevel;
}

export function buildThresholdPredictionLabel(input: {
  event: GameEventType;
  profile: SportProfileKey;
  thresholdLevel: number;
  eventLabel: string;
}): string {
  const requiredCount = getRequiredCountForThresholdLevel(
    input.event,
    input.profile,
    input.thresholdLevel,
  );
  return `${requiredCount}+ ${input.eventLabel}`;
}

export function isThresholdLevelAllowedForEvent(
  event: GameEventType,
  profile: SportProfileKey,
  thresholdLevel: number,
): boolean {
  const normalized = Number.isFinite(thresholdLevel) ? Math.ceil(thresholdLevel) : 1;
  return getAllowedThresholdLevelsForEvent(event, profile).includes(normalized as ThresholdLevel);
}
