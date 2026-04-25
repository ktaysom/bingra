export type SoccerHostStage = "soccer-parent" | "soccer-action" | "soccer-team";

export type GameTeamScope = "both_teams" | "team_a_only" | "team_b_only";

export type TeamKey = "A" | "B";

export function getScopedTeamForGameTeamScope(teamScope: GameTeamScope): TeamKey | null {
  if (teamScope === "team_a_only") return "A";
  if (teamScope === "team_b_only") return "B";
  return null;
}

export function resolveSoccerShotFlowStart(teamScope: GameTeamScope): {
  stage: SoccerHostStage;
  selectedTeamKey: TeamKey | null;
} {
  const scopedTeam = getScopedTeamForGameTeamScope(teamScope);

  if (scopedTeam) {
    return {
      stage: "soccer-action",
      selectedTeamKey: scopedTeam,
    };
  }

  return {
    stage: "soccer-team",
    selectedTeamKey: null,
  };
}

export function resolveSoccerShotBackFromAction(teamScope: GameTeamScope): {
  stage: SoccerHostStage;
  selectedTeamKey: TeamKey | null;
} {
  const scopedTeam = getScopedTeamForGameTeamScope(teamScope);

  if (scopedTeam) {
    return {
      stage: "soccer-parent",
      selectedTeamKey: null,
    };
  }

  return {
    stage: "soccer-team",
    selectedTeamKey: null,
  };
}
