export type GameMode = "classic" | "streak";

export type EventCategory =
  | "scoring"
  | "defense"
  | "turnover"
  | "violation"
  | "free-throw"
  | "hustle"
  | "rare"
  | "misc";

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

  /**
   * 1 = common / safer
   * 5 = rare / riskier
   */
  rarity: 1 | 2 | 3 | 4 | 5;

  /**
   * Base point value used in card valuation.
   * Higher points = more difficult / less frequent event.
   */
  basePoints: number;

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

export const EVENT_CATALOG: GameEventType[] = [
  {
    id: "THREE_POINTER_MADE",
    label: "3-Pointer Made",
    shortLabel: "3 Made",
    description: "A made shot from beyond the 3-point line.",
    category: "scoring",
    rarity: 2,
    basePoints: 30,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["shot", "made-basket"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 90,
  },
  {
    id: "TIMEOUT TAKEN",
    label: "Timeout taken",
    shortLabel: "Timeout",
    description: "A timeout taken",
    category: "misc",
    rarity: 2,
    basePoints: 30,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: [],
    scorerEnabled: true,
    scorerParentCategory: "misc",
    scorerSubtypeGroup: "none",
    scorerOrder: 91,
  },
    {
    id: "OUT_OF_BOUNDS",
    label: "Out of bounds",
    shortLabel: "OOB",
    description: "Turnover due to ball or player out of bounds",
    category: "turnover",
    rarity: 3,
    basePoints: 50,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: [],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 91,
  },
  {
    id: "CHARGE_TAKEN",
    label: "Charge Taken",
    shortLabel: "Charge",
    description: "A defender legally draws an offensive foul.",
    category: "defense",
    rarity: 4,
    basePoints: 70,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "defense",
    tags: ["foul", "hustle"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 20,
  },

  {
    id: "STEAL",
    label: "Steal",
    shortLabel: "Steal",
    description: "A defender cleanly takes possession from the offense.",
    category: "defense",
    rarity: 3,
    basePoints: 45,
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
    id: "DUNK",
    label: "Dunk",
    shortLabel: "Dunk",
    description: "A made dunk.",
    category: "rare",
    rarity: 5,
    basePoints: 100,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["highlight", "made-basket"],
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "none",
    scorerOrder: 80,
  },
  {
    id: "TRAVEL",
    label: "Travel",
    shortLabel: "Travel",
    description: "A travel violation called on the offense.",
    category: "violation",
    rarity: 2,
    basePoints: 28,
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
    id: "DOUBLE_DRIBBLE",
    label: "Double Dribble",
    shortLabel: "Double Drib.",
    description: "A double dribble violation called on the offense.",
    category: "violation",
    rarity: 2,
    basePoints: 30,
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
    id: "MADE_FREE_THROW",
    label: "Standard FT",
    shortLabel: "FT Made",
    description: "A standard made free throw.",
    category: "free-throw",
    rarity: 1,
    basePoints: 18,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["free-throw", "made-shot"],
    scoringNotes:
      "Use for a standard made free throw that is not bonus, double bonus, technical, or and-1.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 70,
  },
  {
    id: "TECHNICAL_FREE_THROW_MADE",
    label: "Technical FT",
    shortLabel: "Tech FT",
    description: "A made technical free throw.",
    category: "free-throw",
    rarity: 3,
    basePoints: 34,
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
    scorerOrder: 73,
  },

  {
    id: "JUMP_BALL_CALL",
    label: "Jump Ball Call",
    shortLabel: "Jump Ball",
    description: "An in-game held-ball / jump-ball call.",
    category: "hustle",
    rarity: 3,
    basePoints: 42,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "none",
    teamRole: "none",
    tags: ["held-ball", "whistle"],
    scoringNotes:
      "This is game-level by default because possession attribution can be messy.",
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 30,
  },
  {
    id: "ILLEGAL_SCREEN",
    label: "Illegal Screen",
    shortLabel: "Illegal Scr.",
    description: "An illegal screen called on the offense.",
    category: "violation",
    rarity: 3,
    basePoints: 45,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "offensive-foul"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 60,
  },
  {
    id: "AND_ONE_CONVERTED",
    label: "And-1 Converted",
    shortLabel: "And-1",
    description:
      "A made basket plus foul, with the free throw also converted.",
    category: "scoring",
    rarity: 4,
    basePoints: 75,
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
    scorerOrder: 74,
  },

  {
    id: "FIVE_SECOND_CALL",
    label: "5-Second Call",
    shortLabel: "5 Sec.",
    description: "A 5-second violation called on the offense.",
    category: "violation",
    rarity: 4,
    basePoints: 58,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 80,
  },
  {
    id: "THREE_SECOND_CALL",
    label: "3-Second Call",
    shortLabel: "3 Sec.",
    description: "A 3-second lane violation called on the offense.",
    category: "violation",
    rarity: 4,
    basePoints: 55,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 70,
  },
  {
    id: "OVER_AND_BACK",
    label: "Over-and-Back",
    shortLabel: "Backcourt",
    description: "A backcourt violation called on the offense.",
    category: "violation",
    rarity: 4,
    basePoints: 60,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["turnover", "violation"],
    scorerEnabled: true,
    scorerParentCategory: "change-of-possession",
    scorerSubtypeGroup: "none",
    scorerOrder: 90,
  },
  {
    id: "BONUS_FREE_THROW_MADE",
    label: "Bonus FT",
    shortLabel: "Bonus FT",
    description: "A made free throw during a one-and-one bonus situation.",
    category: "free-throw",
    rarity: 3,
    basePoints: 35,
    enabled: true,
    allowedModes: ["classic", "streak"],
    teamScope: "team",
    teamRole: "offense",
    tags: ["free-throw", "bonus"],
    scoringNotes:
      "Use when the made free throw occurred in a one-and-one bonus situation.",
    scorerEnabled: true,
    scorerParentCategory: "score",
    scorerSubtypeGroup: "free-throw",
    scorerOrder: 71,
  }
];