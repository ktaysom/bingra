export type GameMode = "classic" | "streak";

import type { SportProfileKey } from "./sport-profiles";

export type EventCategory = "score" | "change_of_possession" | "timeout" | "other";

export type TeamScope = "none" | "team";

export type TeamRole = "offense" | "defense" | "either" | "none";

/**
 * Lightweight scorer UI taxonomy.
 * Keep this small and basketball-first for now.
 */
export type ScorerParentCategory = "change-of-possession" | "score" | "misc";

export type ScorerSubtypeGroup = "free-throw" | "none";

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
};

const ALL_BASKETBALL_PROFILES: SportProfileKey[] = [
  "basketball_high_school",
  "basketball_college",
  "basketball_pro",
];

const HIGH_SCHOOL_ONLY: SportProfileKey[] = ["basketball_high_school"];

const COLLEGE_AND_PRO_ONLY: SportProfileKey[] = [
  "basketball_college",
  "basketball_pro",
];

function samePointsForAllBasketballProfiles(points: number): Partial<Record<SportProfileKey, number>> {
  return {
    basketball_high_school: points,
    basketball_college: points,
    basketball_pro: points,
  };
}

function sameRarityForAllBasketballProfiles(
  rarity: 1 | 2 | 3 | 4 | 5,
): Partial<Record<SportProfileKey, 1 | 2 | 3 | 4 | 5>> {
  return {
    basketball_high_school: rarity,
    basketball_college: rarity,
    basketball_pro: rarity,
  };
}

function profilePoints(input: {
  hs?: number;
  college?: number;
  pro?: number;
}): Partial<Record<SportProfileKey, number>> {
  return {
    ...(input.hs !== undefined ? { basketball_high_school: input.hs } : {}),
    ...(input.college !== undefined ? { basketball_college: input.college } : {}),
    ...(input.pro !== undefined ? { basketball_pro: input.pro } : {}),
  };
}

function profileRarity(input: {
  hs?: 1 | 2 | 3 | 4 | 5;
  college?: 1 | 2 | 3 | 4 | 5;
  pro?: 1 | 2 | 3 | 4 | 5;
}): Partial<Record<SportProfileKey, 1 | 2 | 3 | 4 | 5>> {
  return {
    ...(input.hs !== undefined ? { basketball_high_school: input.hs } : {}),
    ...(input.college !== undefined ? { basketball_college: input.college } : {}),
    ...(input.pro !== undefined ? { basketball_pro: input.pro } : {}),
  };
}

export const EVENT_CATALOG: GameEventType[] = [
  {
    id: "MADE_FREE_THROW",
    label: "Made Free Throw",
    shortLabel: "FT Made",
    description: "A made free throw.",
    category: "score",
    scoringByProfile: profilePoints({ hs: 5, college: 5, pro: 5 }),
    rarityByProfile: profileRarity({ hs: 1, college: 1, pro: 1 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    scoringByProfile: profilePoints({ hs: 25, college: 25, pro: 25 }),
    rarityByProfile: profileRarity({ hs: 4, college: 4, pro: 4 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    scoringByProfile: profilePoints({ hs: 12, college: 12, pro: 12 }),
    rarityByProfile: profileRarity({ hs: 1, college: 1, pro: 1 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    scoringByProfile: profilePoints({ hs: 15, college: 15, pro: 15 }),
    rarityByProfile: profileRarity({ hs: 2, college: 2, pro: 2 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    rarityByProfile: profileRarity({ hs: 3, college: 3, pro: 3 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    rarityByProfile: profileRarity({ hs: 3, college: 3, pro: 3 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    rarityByProfile: profileRarity({ hs: 3, college: 3, pro: 3 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    scoringByProfile: profilePoints({ hs: 5, college: 5, pro: 5 }),
    rarityByProfile: profileRarity({ hs: 1, college: 1, pro: 1 }),
    enabledProfiles: ALL_BASKETBALL_PROFILES,
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
    enabledProfiles: HIGH_SCHOOL_ONLY,
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
    enabledProfiles: COLLEGE_AND_PRO_ONLY,
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
    enabledProfiles: COLLEGE_AND_PRO_ONLY,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 100,
  }
];