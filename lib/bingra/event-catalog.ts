export type GameMode = "classic" | "streak";

import type { SportProfileKey } from "./sport-profiles";
import type {
  SoccerCauseType,
  SoccerOutcomeType,
} from "./soccer-scoring";

export type EventCategory = "score" | "change_of_possession" | "timeout" | "other";

export type TeamScope = "none" | "team";

export type TeamRole = "offense" | "defense" | "either" | "none";

/**
 * Lightweight scorer UI taxonomy.
 * Keep this small and basketball-first for now.
 */
export type ScorerParentCategory = "change-of-possession" | "score" | "misc";

export type ScorerSubtypeGroup =
  | "free-throw"
  | "soccer-shot-on-goal"
  | "soccer-out-of-bounds"
  | "none";

export type SoccerSemanticRole =
  | "cause"
  | "outcome"
  | "discipline"
  | "card_only";

export type SoccerDisciplineType = "yellow_card" | "red_card";

export type GameEventType = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: EventCategory;
  maxThreshold?: number;

  scoringByProfile: Partial<Record<SportProfileKey, number>>;
  rarityByProfile: Partial<Record<SportProfileKey, 1 | 2 | 3 | 4 | 5>>;
  enabledProfiles?: SportProfileKey[];

  enabled: boolean;
  allowedModes: GameMode[];

  /**
   * Whether this event is associated with a specific team.
   * "team" means the host should record it for Team A or Team B.
   * "none" means it is game-level and not team-specific.
   */
  teamScope: TeamScope;

  /**
   * Clarifies what the selected team represents.
   * Example:
   * - steal => defense
   * - travel => offense
   * - banked shot => offense
   */
  teamRole: TeamRole;

  /**
   * Helpful for UI and future card-generation filters.
   */
  tags?: string[];

  /**
   * Optional notes for host scoring / disambiguation.
   */
  scoringNotes?: string;

  /**
   * New: whether this event should appear in the simplified scorer flow.
   * Events can still exist for card generation without being shown to the scorer.
   */
  scorerEnabled?: boolean;

  /**
   * New: parent bucket used by the simplified scorer flow.
   */
  scorerParentCategory?: ScorerParentCategory;

  /**
   * New: optional subgroup for a second tap step.
   * Example: all free-throw variants belong to the "free-throw" subgroup.
   */
  scorerSubtypeGroup?: ScorerSubtypeGroup;

  /**
   * New: order within the scorer UI.
   */
  scorerOrder?: number;

  /**
   * Optional semantic annotations for soccer interpretation.
   * Additive metadata only; does not affect basketball behavior.
   */
  soccerSemanticRole?: SoccerSemanticRole;
  soccerCauseConcept?: SoccerCauseType;
  soccerOutcomeConcept?: SoccerOutcomeType;
  soccerDisciplineType?: SoccerDisciplineType;
};

type ProfilePointsByKey = Partial<Record<SportProfileKey, number>>;
type ProfileRarityByKey = Partial<Record<SportProfileKey, 1 | 2 | 3 | 4 | 5>>;

type BasketballLevelPointsInput = {
  hs?: number;
  college?: number;
  pro?: number;
};

type BasketballLevelRarityInput = {
  hs?: 1 | 2 | 3 | 4 | 5;
  college?: 1 | 2 | 3 | 4 | 5;
  pro?: 1 | 2 | 3 | 4 | 5;
};

const BASKETBALL_PROFILES: SportProfileKey[] = [
  "basketball_high_school",
  "basketball_college",
  "basketball_pro",
];

const SOCCER_PROFILES: SportProfileKey[] = ["soccer_youth", "soccer_high_school"];

const BASKETBALL_HIGH_SCHOOL_PROFILES: SportProfileKey[] = ["basketball_high_school"];

const BASKETBALL_COLLEGE_AND_PRO_PROFILES: SportProfileKey[] = [
  "basketball_college",
  "basketball_pro",
];

function samePointsForProfiles(
  profiles: SportProfileKey[],
  points: number,
): ProfilePointsByKey {
  return profiles.reduce<ProfilePointsByKey>((acc, profile) => {
    acc[profile] = points;
    return acc;
  }, {});
}

function sameRarityForProfiles(
  profiles: SportProfileKey[],
  rarity: 1 | 2 | 3 | 4 | 5,
): ProfileRarityByKey {
  return profiles.reduce<ProfileRarityByKey>((acc, profile) => {
    acc[profile] = rarity;
    return acc;
  }, {});
}

function profilePoints(input: BasketballLevelPointsInput | ProfilePointsByKey): ProfilePointsByKey {
  if ("hs" in input || "college" in input || "pro" in input) {
    const basketballInput = input as BasketballLevelPointsInput;

    return {
      ...(basketballInput.hs !== undefined
        ? { basketball_high_school: basketballInput.hs }
        : {}),
      ...(basketballInput.college !== undefined
        ? { basketball_college: basketballInput.college }
        : {}),
      ...(basketballInput.pro !== undefined ? { basketball_pro: basketballInput.pro } : {}),
    };
  }

  return {
    ...(input as ProfilePointsByKey),
  };
}

function profileRarity(input: BasketballLevelRarityInput | ProfileRarityByKey): ProfileRarityByKey {
  if ("hs" in input || "college" in input || "pro" in input) {
    const basketballInput = input as BasketballLevelRarityInput;

    return {
      ...(basketballInput.hs !== undefined
        ? { basketball_high_school: basketballInput.hs }
        : {}),
      ...(basketballInput.college !== undefined
        ? { basketball_college: basketballInput.college }
        : {}),
      ...(basketballInput.pro !== undefined ? { basketball_pro: basketballInput.pro } : {}),
    };
  }

  return {
    ...(input as ProfileRarityByKey),
  };
}

export const EVENT_CATALOG: GameEventType[] = [
  {
    id: "MADE_FREE_THROW",
    label: "Made Free Throw",
    shortLabel: "FT Made",
    description: "A made free throw.",
    category: "score",
    scoringByProfile: samePointsForProfiles(BASKETBALL_PROFILES, 5),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 1),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot", "made-basket"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 10,
  },
  {
    id: "THREE_POINTER_MADE",
    label: "Made 3PT FG",
    shortLabel: "3PT Made",
    description: "A made shot from beyond the 3-point line.",
    category: "score",
    scoringByProfile: profilePoints({ hs: 20, college: 18, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot", "made-basket"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 20,
  },
  {
    id: "AND_ONE_CONVERTED",
    label: "And-1",
    shortLabel: "And-1",
    description: "A made basket plus foul and the free throw is converted.",
    category: "score",
    scoringByProfile: profilePoints({ hs: 35, college: 30, pro: 25 }),
    rarityByProfile: profileRarity({ hs: 3, college: 3, pro: 3 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["highlight", "three-point-play"],
    scoringNotes:
      "Only count this if the basket is made and the extra free throw is also made.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 30,
  },
  {
    id: "DUNK",
    label: "Dunk",
    shortLabel: "Dunk",
    description: "A made dunk.",
    category: "score",
    scoringByProfile: profilePoints({ hs: 100, college: 65, pro: 40 }),
    rarityByProfile: profileRarity({ hs: 5, college: 4, pro: 3 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["highlight", "made-basket"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 40,
  },
  {
    id: "TECHNICAL_FREE_THROW_MADE",
    label: "Technical Foul Free Throw",
    shortLabel: "Tech FT",
    description: "A made free throw awarded on a technical foul.",
    category: "score",
    scoringByProfile: profilePoints({ hs: 30, college: 30, pro: 25 }),
    rarityByProfile: profileRarity({ hs: 4, college: 4, pro: 3 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["free-throw", "technical"],
    scoringNotes:
      "Use when the made free throw was awarded on a technical foul.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 50,
  },
  {
    id: "BONUS_FREE_THROW_MADE",
    label: "Bonus Free Throw Made",
    shortLabel: "Bonus FT",
    description: "A single made free throw during a bonus situation.",
    category: "score",
    maxThreshold: 3,
    scoringByProfile: samePointsForProfiles(BASKETBALL_PROFILES, 25),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 4),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["free-throw", "bonus"],
    scoringNotes:
      "Use for one made bonus free throw.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 60,
  },

  {
    id: "STEAL",
    label: "Steal",
    shortLabel: "Steal",
    description: "A defender cleanly takes possession from the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 25, college: 22, pro: 20 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["turnover-created"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 10,
  },
  {
    id: "BLOCK",
    label: "Block",
    shortLabel: "Block",
    description: "A blocked shot that changes possession.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 30, college: 25, pro: 22 }),
    rarityByProfile: profileRarity({ hs: 3, college: 3, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["defense", "block"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 20,
  },
  {
    id: "CHARGE_TAKEN",
    label: "Charge Taken",
    shortLabel: "Charge",
    description: "A defender legally draws an offensive foul.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 40, college: 35, pro: 30 }),
    rarityByProfile: profileRarity({ hs: 4, college: 3, pro: 3 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["foul", "hustle"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 30,
  },
  {
    id: "CARRY",
    label: "Carry",
    shortLabel: "Carry",
    description: "A carrying / palming violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 20, college: 18, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 40,
  },
  {
    id: "TRAVEL",
    label: "Travel",
    shortLabel: "Travel",
    description: "A travel violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 20, college: 18, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 50,
  },
  {
    id: "DOUBLE_DRIBBLE",
    label: "Double Dribble",
    shortLabel: "Double Drib.",
    description: "A double dribble violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 20, college: 18, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 55,
  },
  {
    id: "ILLEGAL_SCREEN",
    label: "Illegal Screen",
    shortLabel: "Illegal Scr.",
    description: "An illegal screen called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 20, college: 18, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "offensive-foul"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 58,
  },
  {
    id: "OUT_OF_BOUNDS",
    label: "Out of Bounds",
    shortLabel: "OOB",
    description: "Turnover due to ball or player out of bounds.",
    category: "change_of_possession",
    scoringByProfile: samePointsForProfiles(BASKETBALL_PROFILES, 12),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 1),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "out-of-bounds"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 60,
  },
  {
    id: "JUMP_BALL_CALL",
    label: "Jump Ball Call",
    shortLabel: "Jump Ball",
    description: "An in-game held-ball / jump-ball call.",
    category: "change_of_possession",
    scoringByProfile: samePointsForProfiles(BASKETBALL_PROFILES, 15),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 2),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "none",
    teamRole: "none",
    tags: ["held-ball", "whistle"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 65,
  },
  {
    id: "GOALTENDING",
    label: "Goaltending",
    shortLabel: "Goal Tend",
    description: "A goaltending violation called.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 35, college: 30, pro: 25 }),
    rarityByProfile: profileRarity({ hs: 4, college: 3, pro: 3 }),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["violation", "basketball-iq"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 70,
  },
  {
    id: "THREE_SECOND_CALL",
    label: "3-Second Call",
    shortLabel: "3 Sec",
    description: "A 3-second lane violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 25, college: 22, pro: 20 }),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 3),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 72,
  },
  {
    id: "FIVE_SECOND_CALL",
    label: "5-Second Call",
    shortLabel: "5 Sec",
    description: "A 5-second violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 25, college: 22, pro: 20 }),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 3),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 74,
  },
  {
    id: "OVER_AND_BACK",
    label: "Over-and-Back",
    shortLabel: "Backcourt",
    description: "A backcourt violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 30, college: 28, pro: 25 }),
    rarityByProfile: sameRarityForProfiles(BASKETBALL_PROFILES, 3),
    enabledProfiles: BASKETBALL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation", "backcourt"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 76,
  },
  {
    id: "TIMEOUT_TAKEN",
    label: "Timeout",
    shortLabel: "Timeout",
    description: "A timeout is taken.",
    category: "timeout",
    maxThreshold: 3,
    scoringByProfile: samePointsForProfiles([...BASKETBALL_PROFILES, ...SOCCER_PROFILES], 5),
    rarityByProfile: sameRarityForProfiles([...BASKETBALL_PROFILES, ...SOCCER_PROFILES], 1),
    enabledProfiles: [...BASKETBALL_PROFILES, ...SOCCER_PROFILES],
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["timeout"],
    scorerEnabled: true,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 10,
  },

  {
    id: "TEN_SECOND_VIOLATION",
    label: "10-Second Violation",
    shortLabel: "10 Sec",
    description: "A 10-second backcourt violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ hs: 40 }),
    rarityByProfile: profileRarity({ hs: 4 }),
    enabledProfiles: BASKETBALL_HIGH_SCHOOL_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation", "backcourt"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 80,
  },
  {
    id: "EIGHT_SECOND_VIOLATION",
    label: "8-Second Violation",
    shortLabel: "8 Sec",
    description: "An 8-second backcourt violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ college: 35, pro: 30 }),
    rarityByProfile: profileRarity({ college: 4, pro: 3 }),
    enabledProfiles: BASKETBALL_COLLEGE_AND_PRO_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation", "backcourt"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 90,
  },
  {
    id: "SHOT_CLOCK_VIOLATION",
    label: "Shot Clock Violation",
    shortLabel: "Shot Clock",
    description: "A shot clock violation called on the offense.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ college: 30, pro: 25 }),
    rarityByProfile: profileRarity({ college: 3, pro: 3 }),
    enabledProfiles: BASKETBALL_COLLEGE_AND_PRO_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 100,
  },

  {
    id: "ANY_GOAL",
    label: "Any Goal",
    shortLabel: "Goal",
    description: "Any goal scored in open play or set play.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 8, soccer_high_school: 7 }),
    rarityByProfile: profileRarity({ soccer_youth: 4, soccer_high_school: 4 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["goal", "finishing"],
    scoringNotes:
      "Generic goal option for broad goal tracking. Record either Any Goal or a Shot on Goal goal result for a single play, not both.",
    scorerEnabled: false,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 110,
    soccerSemanticRole: "card_only",
    soccerOutcomeConcept: "goal",
  },
  {
    id: "SHOT_ON_GOAL_GOAL",
    label: "Goal",
    shortLabel: "Goal",
    description: "A shot on target that results in a goal.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 8, soccer_high_school: 7 }),
    rarityByProfile: profileRarity({ soccer_youth: 4, soccer_high_school: 4 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot-on-goal", "goal", "finishing"],
    scoringNotes:
      "Use this when recording via Shot on Goal flow. Do not also record Any Goal for the same play.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 120,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "goal",
  },
  {
    id: "SHOT_ON_GOAL_ASSISTED_GOAL",
    label: "Assisted Goal",
    shortLabel: "Ast Goal",
    description: "A shot on target scored directly from an assisted buildup.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 10, soccer_high_school: 9 }),
    rarityByProfile: profileRarity({ soccer_youth: 5, soccer_high_school: 5 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot-on-goal", "goal", "assist"],
    scoringNotes:
      "Use this when the goal came from an assisted shot-on-goal sequence. Do not also record Any Goal for the same play.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 130,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "assisted_goal",
  },
  {
    id: "SHOT_ON_GOAL_GOAL_OFF_REBOUND",
    label: "Goal off Rebound",
    shortLabel: "Rebound Goal",
    description: "A goal scored after a rebound from an initial on-target attempt.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 9, soccer_high_school: 8 }),
    rarityByProfile: profileRarity({ soccer_youth: 4, soccer_high_school: 4 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot-on-goal", "goal", "rebound"],
    scoringNotes:
      "Use this when the goal is scored off a rebound in a shot-on-goal sequence. Do not also record Any Goal for the same play.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 140,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "goal_off_rebound",
  },
  {
    id: "SHOT_ON_GOAL_SAVE",
    label: "Save",
    shortLabel: "Save",
    description: "A shot on target that is saved by the goalkeeper.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 6, soccer_high_school: 5 }),
    rarityByProfile: profileRarity({ soccer_youth: 3, soccer_high_school: 3 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["shot-on-goal", "save", "goalkeeper"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 150,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "save",
  },
  {
    id: "SHOT_ON_GOAL_BLOCKED",
    label: "Blocked shot",
    shortLabel: "Blocked",
    description: "A shot on target that is blocked by a defender.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 5, soccer_high_school: 4 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["shot-on-goal", "blocked-shot", "defense"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 160,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "blocked",
  },
  {
    id: "SHOT_ON_GOAL_HIT_POST_CROSSBAR",
    label: "Shot hit post/crossbar",
    shortLabel: "Post/Crossbar",
    description: "A shot on target that hits the post or crossbar.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 7, soccer_high_school: 6 }),
    rarityByProfile: profileRarity({ soccer_youth: 4, soccer_high_school: 4 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot-on-goal", "post", "crossbar"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "soccer-shot-on-goal",
    scorerOrder: 170,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "shot_on_goal",
    soccerOutcomeConcept: "hit_post_crossbar",
  },
  {
    id: "SHOT_OFF_TARGET",
    label: "Shot off Target",
    shortLabel: "Shot Off",
    description: "A shot attempt that misses the goal frame.",
    category: "score",
    scoringByProfile: profilePoints({ soccer_youth: 3, soccer_high_school: 2 }),
    rarityByProfile: profileRarity({ soccer_youth: 1, soccer_high_school: 1 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot", "off-target"],
    scoringNotes:
      "Use only when the attempt misses the frame and is not a Shot on Goal outcome.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 180,
    soccerSemanticRole: "cause",
    soccerCauseConcept: "shot_off_target",
    soccerOutcomeConcept: "shot_off_target",
  },

  {
    id: "OUT_OF_BOUNDS_THROW_IN",
    label: "Throw-in",
    shortLabel: "Throw-in",
    description: "Play restarts with a throw-in after the ball goes out of bounds.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 1, soccer_high_school: 1 }),
    rarityByProfile: profileRarity({ soccer_youth: 1, soccer_high_school: 1 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["restart", "out-of-bounds", "throw-in"],
    scoringNotes:
      "Out-of-bounds restart: choose Throw-In when restart is from touchline.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "soccer-out-of-bounds",
    scorerOrder: 110,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "out_of_bounds",
    soccerOutcomeConcept: "throw_in",
  },
  {
    id: "OUT_OF_BOUNDS_CORNER",
    label: "Corner Kick",
    shortLabel: "Corner",
    description: "Play restarts with a corner kick after a defensive touch out of bounds.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 3, soccer_high_school: 3 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["restart", "out-of-bounds", "corner"],
    scoringNotes:
      "Out-of-bounds restart: choose Corner when defender touched it out over goal line.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "soccer-out-of-bounds",
    scorerOrder: 120,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "out_of_bounds",
    soccerOutcomeConcept: "corner_kick",
  },
  {
    id: "OUT_OF_BOUNDS_GOAL_KICK",
    label: "Goal Kick",
    shortLabel: "Goal Kick",
    description: "Play restarts with a goal kick after an attacking touch out of bounds.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 1, soccer_high_school: 1 }),
    rarityByProfile: profileRarity({ soccer_youth: 1, soccer_high_school: 1 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["restart", "out-of-bounds", "goal-kick"],
    scoringNotes:
      "Out-of-bounds restart: choose Goal Kick when attacker touched it out over goal line.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "soccer-out-of-bounds",
    scorerOrder: 130,
    soccerSemanticRole: "outcome",
    soccerCauseConcept: "out_of_bounds",
    soccerOutcomeConcept: "goal_kick",
  },
  {
    id: "FOUL",
    label: "Foul",
    shortLabel: "Foul",
    description: "A foul is called.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 2, soccer_high_school: 2 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["foul", "whistle"],
    scoringNotes:
      "Generic foul call. Use Handball instead when the foul is specifically a handball offense.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 140,
    soccerSemanticRole: "cause",
    soccerCauseConcept: "foul",
  },
  {
    id: "HANDBALL_CALL",
    label: "Handball",
    shortLabel: "Handball",
    description: "A handball offense is called.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 3, soccer_high_school: 3 }),
    rarityByProfile: profileRarity({ soccer_youth: 3, soccer_high_school: 3 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["foul", "handball", "whistle"],
    scoringNotes:
      "Use for handball-specific fouls instead of generic Foul.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 150,
    soccerSemanticRole: "cause",
    soccerCauseConcept: "handball",
  },
  {
    id: "LIVE_BALL_TURNOVER",
    label: "Live Ball Turnover",
    shortLabel: "Live TO",
    description: "Possession is lost in live play without a stoppage.",
    category: "change_of_possession",
    scoringByProfile: profilePoints({ soccer_youth: 3, soccer_high_school: 2 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "live-ball"],
    scoringNotes:
      "Use when possession changes during active play without a whistle and without out-of-bounds restart.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 160,
    soccerSemanticRole: "cause",
    soccerCauseConcept: "live_ball_turnover",
  },

  {
    id: "YELLOW_CARD",
    label: "Yellow Card",
    shortLabel: "Yellow",
    description: "A caution is issued to a player.",
    category: "other",
    scoringByProfile: profilePoints({ soccer_youth: 4, soccer_high_school: 4 }),
    rarityByProfile: profileRarity({ soccer_youth: 3, soccer_high_school: 3 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["card", "discipline"],
    scorerEnabled: true,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 110,
    soccerSemanticRole: "discipline",
    soccerDisciplineType: "yellow_card",
  },
  {
    id: "RED_CARD",
    label: "Red Card",
    shortLabel: "Red",
    description: "A player is sent off with a red card.",
    category: "other",
    scoringByProfile: profilePoints({ soccer_youth: 8, soccer_high_school: 8 }),
    rarityByProfile: profileRarity({ soccer_youth: 5, soccer_high_school: 5 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "either",
    tags: ["card", "discipline", "send-off"],
    scorerEnabled: true,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 120,
    soccerSemanticRole: "discipline",
    soccerDisciplineType: "red_card",
  },
  {
    id: "BALL_HANDLER_FALLS_DOWN",
    label: "Ball Handler Falls Down",
    shortLabel: "Ball Handler Down",
    description: "The player in possession falls, disrupting the play.",
    category: "other",
    scoringByProfile: profilePoints({ soccer_youth: 3, soccer_high_school: 2 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: false,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["ball-control", "slip", "disruption"],
    scorerEnabled: false,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 130,
    soccerSemanticRole: "cause",
    soccerCauseConcept: "live_ball_turnover",
  },
  {
    id: "GOALIE_PUNT_PAST_MIDFIELD",
    label: "Goalie Punt Past Midfield",
    shortLabel: "Punt Midfield",
    description: "A goalkeeper punt travels past midfield.",
    category: "other",
    scoringByProfile: profilePoints({ soccer_youth: 2, soccer_high_school: 2 }),
    rarityByProfile: profileRarity({ soccer_youth: 2, soccer_high_school: 2 }),
    enabledProfiles: SOCCER_PROFILES,
    enabled: false,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["goalkeeper", "punt", "field-position"],
    scorerEnabled: false,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 140,
    soccerSemanticRole: "outcome",
    soccerOutcomeConcept: "none",
  },
];