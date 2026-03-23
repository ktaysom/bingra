import {
  getSportProfileDefinition,
  type SportKey,
  type SportProfileKey,
} from "./sport-profiles";

export function resolveCreateGameSport(profile: SportProfileKey): SportKey {
  return getSportProfileDefinition(profile).sport;
}
