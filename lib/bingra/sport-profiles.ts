export type SportProfileKey =
  | "basketball_youth"
  | "basketball_high_school"
  | "basketball_college"
  | "basketball_pro"
  | "soccer_youth"
  | "soccer_high_school"
  | "soccer_college"
  | "soccer_pro";

export type SportKey = "basketball" | "soccer";

export type SportLevel = "youth" | "high_school" | "college" | "pro";

export type SportProfileDefinition = {
  key: SportProfileKey;
  label: string;
  sport: SportKey;
  level: SportLevel;
};

export const DEFAULT_SPORT_PROFILE: SportProfileKey = "basketball_high_school";

export const SPORT_PROFILES: SportProfileDefinition[] = [
  {
    key: "basketball_youth",
    label: "Youth Basketball",
    sport: "basketball",
    level: "youth",
  },
  {
    key: "basketball_high_school",
    label: "High School Basketball",
    sport: "basketball",
    level: "high_school",
  },
  {
    key: "basketball_college",
    label: "College Basketball",
    sport: "basketball",
    level: "college",
  },
  {
    key: "basketball_pro",
    label: "Professional Basketball",
    sport: "basketball",
    level: "pro",
  },
  {
    key: "soccer_youth",
    label: "Youth Soccer",
    sport: "soccer",
    level: "youth",
  },
  {
    key: "soccer_high_school",
    label: "High School Soccer",
    sport: "soccer",
    level: "high_school",
  },
  {
    key: "soccer_college",
    label: "College Soccer",
    sport: "soccer",
    level: "college",
  },
  {
    key: "soccer_pro",
    label: "Professional Soccer",
    sport: "soccer",
    level: "pro",
  },
];

const SPORT_PROFILES_BY_KEY = new Map(SPORT_PROFILES.map((profile) => [profile.key, profile]));

export function resolveSportProfileKey(value: string | null | undefined): SportProfileKey {
  if (!value) {
    return DEFAULT_SPORT_PROFILE;
  }

  return SPORT_PROFILES_BY_KEY.has(value as SportProfileKey)
    ? (value as SportProfileKey)
    : DEFAULT_SPORT_PROFILE;
}

export function getSportProfileDefinition(profile: SportProfileKey): SportProfileDefinition {
  return SPORT_PROFILES_BY_KEY.get(profile) ?? SPORT_PROFILES_BY_KEY.get(DEFAULT_SPORT_PROFILE)!;
}

export function getSportProfileLabel(profile: SportProfileKey): string {
  return getSportProfileDefinition(profile).label;
}