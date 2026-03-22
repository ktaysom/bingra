export type SportProfileKey =
  | "basketball_high_school"
  | "basketball_college"
  | "basketball_pro";

export type SportKey = "basketball";

export type SportLevel = "high_school" | "college" | "pro";

export type SportProfileDefinition = {
  key: SportProfileKey;
  label: string;
  sport: SportKey;
  level: SportLevel;
};

export const DEFAULT_SPORT_PROFILE: SportProfileKey = "basketball_high_school";

export const SPORT_PROFILES: SportProfileDefinition[] = [
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