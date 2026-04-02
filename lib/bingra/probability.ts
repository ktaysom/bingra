import { EVENT_CATALOG, type GameEventType, type GameMode } from "./event-catalog";
import {
  DEFAULT_SPORT_PROFILE,
  getSportProfileDefinition,
  type SportProfileKey,
} from "./sport-profiles";
import {
  getAllowedThresholdLevelsForEvent,
  getRequiredCountForThresholdLevel,
  normalizeThresholdLevelForEvent,
} from "./threshold-levels";

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type RiskTargetBand = {
  min: number;
  max: number;
};

export type ProbabilityCardCell = {
  event: GameEventType;
  threshold: number;
};

export const RISK_TARGETS: Record<RiskLevel, RiskTargetBand> = {
  1: { min: 0.55, max: 0.8 },
  2: { min: 0.38, max: 0.58 },
  3: { min: 0.22, max: 0.38 },
  4: { min: 0.12, max: 0.24 },
  5: { min: 0.02, max: 0.08 },
};

const BASKETBALL_RARITY_BASE_PROBABILITY: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.88,
  2: 0.62,
  3: 0.34,
  4: 0.14,
  5: 0.04,
};

const SOCCER_RARITY_BASE_PROBABILITY: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.92,
  2: 0.68,
  3: 0.38,
  4: 0.16,
  5: 0.03,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeThreshold(event: GameEventType, threshold: number): number {
  return normalizeThresholdLevelForEvent(event, threshold);
}

function eventTextBlob(event: GameEventType): string {
  const textParts = [event.id, event.label, event.shortLabel, ...(event.tags ?? [])].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  const text =
    (() => {
      const joinFn = textParts.join;
      console.info("[probability][join-check] textParts", {
        context: "eventTextBlob",
        variable: "textParts",
        isArray: Array.isArray(textParts),
        type: typeof textParts,
        hasCallableJoin: typeof joinFn === "function",
      });

      return typeof joinFn === "function"
        ? joinFn.call(textParts, " ")
        : textParts[0] ?? "";
    })();

  return text.toLowerCase();
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function getRiskTargetBand(riskLevel: RiskLevel): RiskTargetBand {
  return RISK_TARGETS[riskLevel];
}

export function getEventBaseProbability(
  event: GameEventType,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): number {
  const rarity = event.rarityByProfile[profile] ?? 3;
  const sport = getSportProfileDefinition(profile).sport;
  const map = sport === "soccer" ? SOCCER_RARITY_BASE_PROBABILITY : BASKETBALL_RARITY_BASE_PROBABILITY;
  return map[rarity];
}

export function getThresholdDecayFactor(event: GameEventType): number {
  const blob = eventTextBlob(event);

  if (
    includesAny(blob, ["dunk", "red card", "assisted goal", "assisted_goal"]) ||
    event.id === "SHOT_ON_GOAL_ASSISTED_GOAL"
  ) {
    return 1.2;
  }

  if (
    includesAny(blob, [
      "carry",
      "double dribble",
      "double_dribble",
      "goaltending",
      "charge",
      "technical",
      "tech",
    ])
  ) {
    return 0.7;
  }

  if (includesAny(blob, ["steal", "block", "foul", "turnover", "jump"])) {
    return 0.35;
  }

  if (includesAny(blob, ["free-throw", "out-of-bounds", "throw-in", "goal-kick", "shot"])) {
    return 0.15;
  }

  return 0.5;
}

export function getThresholdProbability(
  event: GameEventType,
  threshold: number,
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): number {
  const base = getEventBaseProbability(event, profile);
  const teamAdjustedBase =
    event.teamScope === "team"
      ? 1 - Math.pow(1 - base, 2)
      : base;
  const normalizedThreshold = normalizeThreshold(event, threshold);
  const requiredCount = getRequiredCountForThresholdLevel(event, profile, normalizedThreshold);
  const decayFactor = getThresholdDecayFactor(event);
  const exponent = 1 + (requiredCount - 1) * decayFactor;
  const probability = Math.pow(teamAdjustedBase, exponent);

  return clamp(probability, 0.01, 0.98);
}

export function estimateCardCompletionProbability(
  cells: ProbabilityCardCell[],
  profile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): number {
  return cells.reduce(
    (product, cell) => product * getThresholdProbability(cell.event, cell.threshold, profile),
    1,
  );
}

function getEnabledEventsForGeneration(mode: GameMode | undefined, profile: SportProfileKey): GameEventType[] {
  return EVENT_CATALOG.filter((event) => {
    if (!event.enabled) {
      return false;
    }

    if (mode && !event.allowedModes.includes(mode)) {
      return false;
    }

    if (!event.enabledProfiles || event.enabledProfiles.length === 0) {
      return true;
    }

    return event.enabledProfiles.includes(profile);
  });
}

function distanceToBand(probability: number, band: RiskTargetBand): number {
  if (probability < band.min) {
    return band.min - probability;
  }

  if (probability > band.max) {
    return probability - band.max;
  }

  return 0;
}

function shuffle<T>(input: T[]): T[] {
  const values = [...input];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }

  return values;
}

export function generateCardForRisk(
  profile: SportProfileKey,
  riskLevel: RiskLevel,
  settings: {
    count: number;
    mode?: GameMode;
    uniqueByEventId?: boolean;
    includeGameScopedEvents?: boolean;
    maxRetries?: number;
  },
): ProbabilityCardCell[] {
  const count = Math.max(0, settings.count);

  if (count === 0) {
    return [];
  }

  const uniqueByEventId = settings.uniqueByEventId ?? true;
  const includeGameScopedEvents = settings.includeGameScopedEvents ?? true;
  const maxRetries = Math.max(1, settings.maxRetries ?? 5);
  const targetBand = getRiskTargetBand(riskLevel);
  const targetMidpoint = (targetBand.min + targetBand.max) / 2;
  const targetPerCellProbability = Math.pow(targetMidpoint, 1 / count);

  let eventPool = getEnabledEventsForGeneration(settings.mode, profile);

  if (!includeGameScopedEvents) {
    eventPool = eventPool.filter((event) => event.teamScope === "team");
  }

  if (eventPool.length === 0) {
    return [];
  }

  const candidateCombos = eventPool.flatMap((event) => {
    const levels = getAllowedThresholdLevelsForEvent(event, profile);

    return levels.map((threshold) => {
      return {
        event,
        threshold,
        probability: getThresholdProbability(event, threshold, profile),
      };
    });
  });

  let bestCard: ProbabilityCardCell[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const selected: ProbabilityCardCell[] = [];
    const usedEventIds = new Set<string>();
    const categoryCounts = new Map<string, number>();
    let rareCount = 0;
    let easyCount = 0;
    let runningProbability = 1;

    for (let slot = 0; slot < count; slot += 1) {
      let bestCandidate: (typeof candidateCombos)[number] | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      const viableTopCandidates: Array<(typeof candidateCombos)[number]> = [];

      for (const candidate of shuffle(candidateCombos)) {
        if (uniqueByEventId && usedEventIds.has(candidate.event.id)) {
          continue;
        }

        const categoryCount = categoryCounts.get(candidate.event.category) ?? 0;
        if (categoryCount >= 2) {
          continue;
        }

        const candidateRarity = candidate.event.rarityByProfile[profile] ?? 3;
        const isRare = candidateRarity >= 4;
        if (isRare && rareCount >= 2) {
          continue;
        }

        const isEasy = candidate.probability > 0.5;
        if (riskLevel <= 3) {
          const projectedEasyCount = easyCount + (isEasy ? 1 : 0);
          const remainingAfterPick = count - (slot + 1);

          if (projectedEasyCount + remainingAfterPick < 2) {
            continue;
          }
        }

        const nextProbability = runningProbability * candidate.probability;
        const remainingSlots = count - (slot + 1);
        const projectedFullProbability =
          nextProbability * Math.pow(targetPerCellProbability, remainingSlots);
        const bandDistance = distanceToBand(projectedFullProbability, targetBand);
        const midpointDistance = Math.abs(projectedFullProbability - targetMidpoint);
        const score = bandDistance * 100 + midpointDistance;

        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          viableTopCandidates.length = 0;
          viableTopCandidates.push(candidate);
        } else if (Math.abs(score - bestScore) <= 0.01) {
          viableTopCandidates.push(candidate);
        }
      }

      if (!bestCandidate) {
        break;
      }

      if (viableTopCandidates.length > 1) {
        const picked = viableTopCandidates[Math.floor(Math.random() * viableTopCandidates.length)];
        if (picked) {
          bestCandidate = picked;
        }
      }

      selected.push({
        event: bestCandidate.event,
        threshold: bestCandidate.threshold,
      });

      runningProbability *= bestCandidate.probability;

      if (uniqueByEventId) {
        usedEventIds.add(bestCandidate.event.id);
      }

      categoryCounts.set(
        bestCandidate.event.category,
        (categoryCounts.get(bestCandidate.event.category) ?? 0) + 1,
      );

      if ((bestCandidate.event.rarityByProfile[profile] ?? 3) >= 4) {
        rareCount += 1;
      }

      if (bestCandidate.probability > 0.5) {
        easyCount += 1;
      }
    }

    if (selected.length !== count) {
      continue;
    }

    if (riskLevel <= 3 && easyCount < 2) {
      continue;
    }

    const fullProbability = estimateCardCompletionProbability(selected, profile);
    const finalDistance = distanceToBand(fullProbability, targetBand);

    if (finalDistance < bestDistance) {
      bestDistance = finalDistance;
      bestCard = selected;
    }

    if (finalDistance === 0) {
      return selected;
    }
  }

  return bestCard;
}
