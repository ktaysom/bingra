import type { TeamKey } from "./event-logic";

export const SOCCER_CAUSE_TYPES = [
  "out_of_bounds",
  "foul",
  "handball",
  "live_ball_turnover",
  "shot_on_goal",
  "shot_off_target",
] as const;

export const SOCCER_OUTCOME_TYPES = [
  "throw_in",
  "goal_kick",
  "corner_kick",
  "goal",
  "assisted_goal",
  "goal_off_rebound",
  "save",
  "blocked",
  "hit_post_crossbar",
  "shot_off_target",
  "none",
] as const;

export type SoccerCauseType = (typeof SOCCER_CAUSE_TYPES)[number];

export type SoccerOutcomeType = (typeof SOCCER_OUTCOME_TYPES)[number];

export type SoccerScoringInput = {
  legacyEventKey?: string;
  legacyTeamKey?: TeamKey | null;
  causeType?: SoccerCauseType;
  outcomeType?: SoccerOutcomeType;
  causingTeamKey?: TeamKey | null;
  beneficiaryTeamKey?: TeamKey | null;
};

export type SoccerScoringMetadata = {
  causeType: SoccerCauseType;
  outcomeType: SoccerOutcomeType;
  causingTeamKey: TeamKey | null;
  beneficiaryTeamKey: TeamKey | null;
  beneficiaryDerivation: "explicit" | "derived" | "legacy";
};

export type SoccerScoringCompatibilityResult = {
  eventKey: string;
  compatibilityTeamKey: TeamKey | null;
  metadata: SoccerScoringMetadata | null;
};

function oppositeTeam(team: TeamKey | null | undefined): TeamKey | null {
  if (team === "A") return "B";
  if (team === "B") return "A";
  return null;
}

function resolveEventKey(causeType: SoccerCauseType, outcomeType: SoccerOutcomeType): string {
  if (causeType === "out_of_bounds") {
    if (outcomeType === "throw_in") return "OUT_OF_BOUNDS_THROW_IN";
    if (outcomeType === "goal_kick") return "OUT_OF_BOUNDS_GOAL_KICK";
    if (outcomeType === "corner_kick") return "OUT_OF_BOUNDS_CORNER";
    throw new Error("out_of_bounds requires throw_in, goal_kick, or corner_kick");
  }

  if (causeType === "foul") {
    return "FOUL";
  }

  if (causeType === "handball") {
    return "HANDBALL_CALL";
  }

  if (causeType === "live_ball_turnover") {
    return "LIVE_BALL_TURNOVER";
  }

  if (causeType === "shot_off_target") {
    return "SHOT_OFF_TARGET";
  }

  if (outcomeType === "goal") return "SHOT_ON_GOAL_GOAL";
  if (outcomeType === "assisted_goal") return "SHOT_ON_GOAL_ASSISTED_GOAL";
  if (outcomeType === "goal_off_rebound") return "SHOT_ON_GOAL_GOAL_OFF_REBOUND";
  if (outcomeType === "save") return "SHOT_ON_GOAL_SAVE";
  if (outcomeType === "blocked") return "SHOT_ON_GOAL_BLOCKED";
  if (outcomeType === "hit_post_crossbar") return "SHOT_ON_GOAL_HIT_POST_CROSSBAR";

  throw new Error("shot_on_goal requires a valid shot_on_goal outcome");
}

function deriveBeneficiaryTeam(input: {
  causeType: SoccerCauseType;
  outcomeType: SoccerOutcomeType;
  causingTeamKey: TeamKey | null;
}): TeamKey | null {
  const { causeType, outcomeType, causingTeamKey } = input;

  if (causeType === "out_of_bounds" || causeType === "foul" || causeType === "handball") {
    return oppositeTeam(causingTeamKey);
  }

  if (causeType === "live_ball_turnover") {
    return oppositeTeam(causingTeamKey);
  }

  if (causeType === "shot_off_target") {
    return causingTeamKey;
  }

  if (outcomeType === "save" || outcomeType === "blocked") {
    return oppositeTeam(causingTeamKey);
  }

  return causingTeamKey;
}

export function interpretSoccerScoringInput(
  input: SoccerScoringInput,
): SoccerScoringCompatibilityResult {
  const {
    legacyEventKey,
    legacyTeamKey,
    causeType,
    outcomeType,
    causingTeamKey,
    beneficiaryTeamKey,
  } = input;

  if (!causeType) {
    if (!legacyEventKey) {
      throw new Error("Missing soccer scoring event key");
    }

    return {
      eventKey: legacyEventKey,
      compatibilityTeamKey: legacyTeamKey ?? null,
      metadata: null,
    };
  }

  const resolvedOutcome: SoccerOutcomeType =
    outcomeType ?? (causeType === "foul" || causeType === "handball" || causeType === "live_ball_turnover"
      ? "none"
      : causeType === "shot_off_target"
        ? "shot_off_target"
        : "none");

  const eventKey = resolveEventKey(causeType, resolvedOutcome);
  const derivedBeneficiary = deriveBeneficiaryTeam({
    causeType,
    outcomeType: resolvedOutcome,
    causingTeamKey: causingTeamKey ?? null,
  });
  const resolvedBeneficiary = beneficiaryTeamKey ?? derivedBeneficiary;

  return {
    eventKey,
    compatibilityTeamKey: resolvedBeneficiary ?? null,
    metadata: {
      causeType,
      outcomeType: resolvedOutcome,
      causingTeamKey: causingTeamKey ?? null,
      beneficiaryTeamKey: resolvedBeneficiary ?? null,
      beneficiaryDerivation: beneficiaryTeamKey ? "explicit" : "derived",
    },
  };
}
