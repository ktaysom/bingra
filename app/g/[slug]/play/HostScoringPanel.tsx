"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ScorerParentCategory,
  ScorerSubtypeGroup,
} from "../../../../lib/bingra/event-catalog";
import {
  getEventById,
  getScorerEventsForParent,
  getScorerOptionById,
  getScorerParentOptions,
  getScorerSubtypeOptions,
} from "../../../../lib/bingra/event-logic";
import {
  DEFAULT_SPORT_PROFILE,
  getSportProfileDefinition,
  type SportProfileKey,
} from "../../../../lib/bingra/sport-profiles";
import { resolveBaseEventKey } from "../../../../lib/bingra/card-event-key";
import {
  recordEventAction,
  type RecordEventFormState,
} from "../../../actions/record-event";
import {
  deleteScoredEventAction,
  type DeleteScoredEventFormState,
} from "../../../actions/delete-scored-event";

type HostScoringPanelProps = {
  slug: string;
  isFinished?: boolean;
  teamScope?: "both_teams" | "team_a_only" | "team_b_only";
  teamNames?: {
    A: string;
    B: string;
  };
  sportProfile?: SportProfileKey;
};

type RecentEvent = {
  recordedEventId?: string;
  eventKey?: string;
  label: string;
  team?: string | null;
  timestamp: string;
};

type Stage =
  | "parent"
  | "event"
  | "subtype"
  | "team"
  | "soccer-parent"
  | "soccer-action"
  | "soccer-out-of-bounds"
  | "soccer-team";

type SoccerParentId =
  | "change_of_possession"
  | "shot"
  | "red_card"
  | "yellow_card"
  | "timeout";

type SoccerActionId =
  | "out_of_bounds"
  | "foul"
  | "handball"
  | "live_ball_turnover"
  | "goal"
  | "goal_off_rebound"
  | "assisted_goal"
  | "save"
  | "blocked"
  | "hit_post_crossbar"
  | "shot_off_target"
  | "red_card"
  | "yellow_card"
  | "timeout";

type SoccerActionConfig = {
  id: SoccerActionId;
  parent: SoccerParentId;
  label: string;
  eventKey: string;
};

type SoccerOutOfBoundsOption = {
  id: "throw_in" | "goal_kick" | "corner_kick";
  label: string;
  eventKey: "OUT_OF_BOUNDS_THROW_IN" | "OUT_OF_BOUNDS_GOAL_KICK" | "OUT_OF_BOUNDS_CORNER";
};

const SOCCER_PARENT_OPTIONS: Array<{ id: SoccerParentId; label: string }> = [
  { id: "change_of_possession", label: "Change of possession" },
  { id: "shot", label: "Shot" },
  { id: "red_card", label: "Red card" },
  { id: "yellow_card", label: "Yellow card" },
  { id: "timeout", label: "Timeout" },
];

const SOCCER_ACTIONS: SoccerActionConfig[] = [
  { id: "out_of_bounds", parent: "change_of_possession", label: "Out of bounds", eventKey: "OUT_OF_BOUNDS_THROW_IN" },
  { id: "foul", parent: "change_of_possession", label: "Foul", eventKey: "FOUL" },
  { id: "handball", parent: "change_of_possession", label: "Handball", eventKey: "HANDBALL_CALL" },
  { id: "live_ball_turnover", parent: "change_of_possession", label: "Live Ball Turnover", eventKey: "LIVE_BALL_TURNOVER" },
  { id: "goal", parent: "shot", label: "Goal", eventKey: "SHOT_ON_GOAL_GOAL" },
  { id: "goal_off_rebound", parent: "shot", label: "Goal off Rebound", eventKey: "SHOT_ON_GOAL_GOAL_OFF_REBOUND" },
  { id: "assisted_goal", parent: "shot", label: "Assisted Goal", eventKey: "SHOT_ON_GOAL_ASSISTED_GOAL" },
  { id: "save", parent: "shot", label: "Save", eventKey: "SHOT_ON_GOAL_SAVE" },
  { id: "blocked", parent: "shot", label: "Blocked shot", eventKey: "SHOT_ON_GOAL_BLOCKED" },
  { id: "hit_post_crossbar", parent: "shot", label: "Shot hit post/crossbar", eventKey: "SHOT_ON_GOAL_HIT_POST_CROSSBAR" },
  { id: "shot_off_target", parent: "shot", label: "Shot off Target", eventKey: "SHOT_OFF_TARGET" },
  { id: "red_card", parent: "red_card", label: "Red card", eventKey: "RED_CARD" },
  { id: "yellow_card", parent: "yellow_card", label: "Yellow card", eventKey: "YELLOW_CARD" },
  { id: "timeout", parent: "timeout", label: "Timeout", eventKey: "TIMEOUT_TAKEN" },
];

const SOCCER_ACTIONS_BY_ID = new Map(
  SOCCER_ACTIONS.map((action) => [action.id, action]),
);

const SOCCER_OUT_OF_BOUNDS_OPTIONS: SoccerOutOfBoundsOption[] = [
  { id: "throw_in", label: "Throw-in", eventKey: "OUT_OF_BOUNDS_THROW_IN" },
  { id: "goal_kick", label: "Goal Kick", eventKey: "OUT_OF_BOUNDS_GOAL_KICK" },
  { id: "corner_kick", label: "Corner Kick", eventKey: "OUT_OF_BOUNDS_CORNER" },
];

const initialRecordState: RecordEventFormState = {};
const initialDeleteState: DeleteScoredEventFormState = {};

export function HostScoringPanel({
  slug,
  isFinished = false,
  teamScope = "both_teams",
  teamNames = { A: "Team A", B: "Team B" },
  sportProfile = DEFAULT_SPORT_PROFILE,
}: HostScoringPanelProps) {
  const router = useRouter();
  const isSoccer = getSportProfileDefinition(sportProfile).sport === "soccer";

  const [recordState, recordAction] = useActionState(recordEventAction, initialRecordState);
  const [deleteState, deleteAction] = useActionState(
    deleteScoredEventAction,
    initialDeleteState,
  );

  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [stage, setStage] = useState<Stage>(isSoccer ? "soccer-parent" : "parent");
  const [parent, setParent] = useState<ScorerParentCategory | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string | null>(null);
  const [selectedSubtypeGroup, setSelectedSubtypeGroup] = useState<ScorerSubtypeGroup | null>(
    null,
  );
  const [selectedSoccerParentId, setSelectedSoccerParentId] = useState<SoccerParentId | null>(null);
  const [selectedSoccerActionId, setSelectedSoccerActionId] = useState<SoccerActionId | null>(null);
  const [selectedSoccerOutOfBoundsOption, setSelectedSoccerOutOfBoundsOption] =
    useState<SoccerOutOfBoundsOption | null>(null);

  const lastSubmissionRef = useRef<RecentEvent | null>(null);

  const parentOptions = useMemo(() => getScorerParentOptions(undefined, sportProfile), [sportProfile]);
  const eventOptions = useMemo(() => {
    return parent ? getScorerEventsForParent(parent, undefined, sportProfile) : [];
  }, [parent, sportProfile]);

  const selectedEventOption = useMemo(() => {
    return selectedEventId ? getScorerOptionById(selectedEventId, undefined, sportProfile) : undefined;
  }, [selectedEventId, sportProfile]);

  const selectedSubtypeOption = useMemo(() => {
    return selectedSubtypeId ? getScorerOptionById(selectedSubtypeId, undefined, sportProfile) : undefined;
  }, [selectedSubtypeId, sportProfile]);

  const subtypeOptions = useMemo(() => {
    if (!selectedSubtypeGroup) {
      return [];
    }

    return getScorerSubtypeOptions(selectedSubtypeGroup, undefined, sportProfile);
  }, [selectedSubtypeGroup, sportProfile]);

  const finalEvent = selectedSubtypeOption ?? selectedEventOption;
  const selectedSoccerAction = selectedSoccerActionId
    ? SOCCER_ACTIONS_BY_ID.get(selectedSoccerActionId) ?? null
    : null;

  const soccerActionOptions = useMemo(() => {
    if (!selectedSoccerParentId) {
      return [];
    }

    return SOCCER_ACTIONS.filter((action) => action.parent === selectedSoccerParentId);
  }, [selectedSoccerParentId]);

  useEffect(() => {
    setStage(isSoccer ? "soccer-parent" : "parent");
    setParent(null);
    setSelectedEventId(null);
    setSelectedSubtypeId(null);
    setSelectedSubtypeGroup(null);
    setSelectedSoccerParentId(null);
    setSelectedSoccerActionId(null);
    setSelectedSoccerOutOfBoundsOption(null);
  }, [isSoccer]);

  useEffect(() => {
    if (recordState.success && recordState.completedAt && lastSubmissionRef.current) {
      const recordedEventId = recordState.recordedEventId;
      const nextEvent: RecentEvent = {
        ...lastSubmissionRef.current,
        recordedEventId: recordedEventId ?? lastSubmissionRef.current.recordedEventId,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };

      setRecentEvents((prev) => [nextEvent, ...prev].slice(0, 5));
      setStage(isSoccer ? "soccer-parent" : "parent");
      setParent(null);
      setSelectedEventId(null);
      setSelectedSubtypeId(null);
      setSelectedSubtypeGroup(null);
      setSelectedSoccerParentId(null);
      setSelectedSoccerActionId(null);
      setSelectedSoccerOutOfBoundsOption(null);
      lastSubmissionRef.current = null;
      router.refresh();
    }
  }, [isSoccer, recordState.success, recordState.completedAt, recordState.recordedEventId, router]);

  useEffect(() => {
    if (deleteState.success && deleteState.completedAt && deleteState.removedEventId) {
      setRecentEvents((prev) =>
        prev.filter((entry) => entry.recordedEventId !== deleteState.removedEventId),
      );
      router.refresh();
    }
  }, [deleteState.success, deleteState.completedAt, deleteState.removedEventId, router]);

  const isScoringLocked = isFinished || Boolean(recordState.blocked);
  const lockReason =
    recordState.blockedReason ??
    (isFinished ? "Scoring is locked because this game has ended." : undefined);

  function submitEvent(eventId: string, label: string, team?: "A" | "B" | null) {
    if (isScoringLocked) return;

    lastSubmissionRef.current = {
      eventKey: eventId,
      label: label || getEventById(eventId)?.label || eventId,
      team: team ?? null,
      timestamp: "",
    };

    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("eventKey", eventId);
    formData.set("sportProfile", sportProfile);
    if (team) {
      formData.set("team", team);
    }

    startTransition(() => {
      recordAction(formData);
    });
  }

  function undoRecent(recordedEventId?: string) {
    if (!recordedEventId) return;

    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("recordedEventId", recordedEventId);

    startTransition(() => {
      deleteAction(formData);
    });
  }

  function getScopedTeamForCurrentGame(): "A" | "B" | null {
    if (teamScope === "team_a_only") return "A";
    if (teamScope === "team_b_only") return "B";
    return null;
  }

  function handleParentSelect(nextParent: ScorerParentCategory) {
    setParent(nextParent);
    setSelectedEventId(null);
    setSelectedSubtypeId(null);
    setSelectedSubtypeGroup(null);
    setStage("event");
  }

  function handleEventSelect(option: { id: string; label: string; subtypeGroup?: string }) {
    if (option.subtypeGroup && option.subtypeGroup !== "none") {
      setSelectedEventId(null);
      setSelectedSubtypeId(null);
      setSelectedSubtypeGroup(option.subtypeGroup as ScorerSubtypeGroup);
      setStage("subtype");
      return;
    }

    const resolved = getScorerOptionById(option.id, undefined, sportProfile);
    if (!resolved) return;

    setSelectedEventId(resolved.id);
    setSelectedSubtypeId(null);
    setSelectedSubtypeGroup(null);

    if (resolved.requiresTeam) {
      const scopedTeam = getScopedTeamForCurrentGame();
      if (scopedTeam) {
        submitEvent(resolved.id, resolved.label, scopedTeam);
        return;
      }

      setStage("team");
      return;
    }

    submitEvent(resolved.id, resolved.label, null);
  }

  function handleSubtypeSelect(subtypeId: string) {
    const resolved = getScorerOptionById(subtypeId, undefined, sportProfile);
    if (!resolved) return;

    setSelectedSubtypeId(resolved.id);

    if (resolved.requiresTeam) {
      const scopedTeam = getScopedTeamForCurrentGame();
      if (scopedTeam) {
        submitEvent(resolved.id, resolved.label, scopedTeam);
        return;
      }

      setStage("team");
      return;
    }

    submitEvent(resolved.id, resolved.label, null);
  }

  function handleSoccerParentSelect(nextParent: SoccerParentId) {
    if (nextParent === "red_card" || nextParent === "yellow_card" || nextParent === "timeout") {
      const action = SOCCER_ACTIONS_BY_ID.get(nextParent);
      if (!action) return;

      setSelectedSoccerParentId(nextParent);
      setSelectedSoccerActionId(nextParent);
      setSelectedSoccerOutOfBoundsOption(null);

      const scopedTeam = getScopedTeamForCurrentGame();
      if (scopedTeam) {
        submitEvent(action.eventKey, action.label, scopedTeam);
        return;
      }

      setStage("soccer-team");
      return;
    }

    setSelectedSoccerParentId(nextParent);
    setSelectedSoccerActionId(null);
    setSelectedSoccerOutOfBoundsOption(null);
    setStage("soccer-action");
  }

  function handleSoccerActionSelect(actionId: SoccerActionId) {
    const action = SOCCER_ACTIONS_BY_ID.get(actionId);
    if (!action) return;

    setSelectedSoccerActionId(actionId);

    if (actionId === "out_of_bounds") {
      setSelectedSoccerOutOfBoundsOption(null);
      setStage("soccer-out-of-bounds");
      return;
    }

    const scopedTeam = getScopedTeamForCurrentGame();
    if (scopedTeam) {
      submitEvent(action.eventKey, action.label, scopedTeam);
      return;
    }

    setStage("soccer-team");
  }

  function handleSoccerOutOfBoundsSelect(optionId: SoccerOutOfBoundsOption["id"]) {
    const option = SOCCER_OUT_OF_BOUNDS_OPTIONS.find((item) => item.id === optionId);
    if (!option) return;

    setSelectedSoccerOutOfBoundsOption(option);

    const scopedTeam = getScopedTeamForCurrentGame();
    if (scopedTeam) {
      submitEvent(option.eventKey, option.label, scopedTeam);
      return;
    }

    setStage("soccer-team");
  }

  function handleTeamSelect(team: "A" | "B") {
    if (isSoccer) {
      if (selectedSoccerActionId === "out_of_bounds") {
        if (!selectedSoccerOutOfBoundsOption) return;
        submitEvent(
          selectedSoccerOutOfBoundsOption.eventKey,
          selectedSoccerOutOfBoundsOption.label,
          team,
        );
        return;
      }

      if (!selectedSoccerAction) return;
      submitEvent(selectedSoccerAction.eventKey, selectedSoccerAction.label, team);
      return;
    }

    if (!finalEvent) return;
    submitEvent(finalEvent.id, finalEvent.label, team);
  }

  function handleBack() {
    if (isSoccer) {
      if (stage === "soccer-team") {
        if (selectedSoccerActionId === "out_of_bounds") {
          setStage("soccer-out-of-bounds");
          return;
        }

        if (
          selectedSoccerParentId === "red_card" ||
          selectedSoccerParentId === "yellow_card" ||
          selectedSoccerParentId === "timeout"
        ) {
          setStage("soccer-parent");
          return;
        }

        setStage("soccer-action");
        return;
      }

      if (stage === "soccer-out-of-bounds") {
        setStage("soccer-action");
        setSelectedSoccerOutOfBoundsOption(null);
        return;
      }

      if (stage === "soccer-action") {
        setStage("soccer-parent");
        setSelectedSoccerActionId(null);
        setSelectedSoccerOutOfBoundsOption(null);
        return;
      }

      return;
    }

    if (stage === "event") {
      setStage("parent");
      setParent(null);
      setSelectedEventId(null);
      setSelectedSubtypeId(null);
      setSelectedSubtypeGroup(null);
      return;
    }

    if (stage === "subtype") {
      setStage("event");
      setSelectedSubtypeId(null);
      setSelectedSubtypeGroup(null);
      return;
    }

    if (stage === "team") {
      if (selectedSubtypeId) {
        setStage("subtype");
      } else {
        setStage("event");
      }
    }
  }

  function getTitle() {
    if (isSoccer) {
      if (stage === "soccer-action") {
        return SOCCER_PARENT_OPTIONS.find((option) => option.id === selectedSoccerParentId)?.label ?? "Record event";
      }

      if (stage === "soccer-team") {
        return "Choose team";
      }

      if (stage === "soccer-out-of-bounds") {
        return "Out of bounds";
      }

      return "Record event";
    }

    switch (stage) {
      case "event":
        if (parent === "score") return "Score";
        if (parent === "misc") return "Time Out";
        return "Change of possession";
      case "subtype":
        return "Made free throw";
      case "team":
        return "Choose team";
      case "parent":
      default:
        return "Record event";
    }
  }

  const showBackButton =
    !isScoringLocked &&
    (isSoccer ? stage !== "soccer-parent" : stage !== "parent");

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">
            Host scoring
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{getTitle()}</h2>
          {teamScope !== "both_teams" && (
            <p className="mt-1 text-xs font-medium text-bingra-gray-medium">
              Scoring for: {teamScope === "team_a_only" ? teamNames.A : teamNames.B}
            </p>
          )}
        </div>

        {showBackButton && (
          <button
            type="button"
            onClick={handleBack}
            className="btn-secondary rounded-2xl px-3 py-1.5 text-sm font-medium"
          >
            Back
          </button>
        )}
      </div>

      {recordState.error && <p className="mt-3 text-xs text-red-600">{recordState.error}</p>}
      {deleteState.error && <p className="mt-3 text-xs text-red-600">{deleteState.error}</p>}
      {recordState.success && <p className="mt-3 text-xs text-bingra-green">Recorded.</p>}

      {lockReason && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Scoring locked</p>
          <p className="mt-1 text-xs text-amber-800">{lockReason}</p>
        </div>
      )}

      {!isScoringLocked ? (
        <div className="mt-4">
          {isSoccer && stage === "soccer-parent" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SOCCER_PARENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSoccerParentSelect(option.id)}
                  className="min-h-20 rounded-2xl bg-white/90 px-4 py-5 text-left text-base font-semibold text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {isSoccer && stage === "soccer-action" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {soccerActionOptions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSoccerActionSelect(action.id)}
                  className="min-h-16 rounded-2xl bg-white/90 px-4 py-4 text-left text-base font-medium text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {isSoccer && stage === "soccer-out-of-bounds" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SOCCER_OUT_OF_BOUNDS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSoccerOutOfBoundsSelect(option.id)}
                  className="min-h-16 rounded-2xl bg-white/90 px-4 py-4 text-left text-base font-medium text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {isSoccer && stage === "soccer-team" && (
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => handleTeamSelect(team)}
                  className="btn-primary min-h-20 w-full rounded-2xl px-4 py-5 text-center text-base"
                >
                  {teamNames[team]}
                </button>
              ))}
            </div>
          )}

          {!isSoccer && stage === "parent" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {parentOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleParentSelect(option.id)}
                  className="min-h-20 rounded-2xl bg-white/90 px-4 py-5 text-left text-base font-semibold text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {!isSoccer && stage === "event" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {eventOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleEventSelect(option)}
                  className="min-h-16 rounded-2xl bg-white/90 px-4 py-4 text-left text-base font-medium text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {!isSoccer && stage === "subtype" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subtypeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSubtypeSelect(option.id)}
                  className="min-h-16 rounded-2xl bg-white/90 px-4 py-4 text-left text-base font-medium text-slate-900 shadow-sm transition-all duration-150 hover:scale-[1.02]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {!isSoccer && stage === "team" && (
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => handleTeamSelect(team)}
                  className="btn-primary min-h-20 w-full rounded-2xl px-4 py-5 text-center text-base"
                >
                  {teamNames[team]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
          <p className="font-semibold">Scoring locked</p>
          <p className="mt-1 text-xs text-amber-800">
            {lockReason ?? "This game has ended. New scoring submissions are blocked."}
          </p>
        </div>
      )}

      {recentEvents.length > 0 && (
        <div className="surface-card mt-6 p-4 text-xs text-bingra-gray-medium">
          <p className="text-xs font-semibold uppercase tracking-wide text-bingra-gray-medium">Recent</p>
          <ul className="mt-3 space-y-2">
            {recentEvents.map((entry, index) => {
              const baseEventKey = resolveBaseEventKey(entry.eventKey);
              const catalogEvent = baseEventKey ? getEventById(baseEventKey) : undefined;
              const label = catalogEvent?.label ?? entry.label ?? "Recorded event";
              const isNewest = index === 0 && !!entry.recordedEventId;

              return (
                <li
                  key={`${entry.recordedEventId ?? entry.eventKey ?? entry.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{label}</p>
                    {entry.team ? (
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {entry.team === "A" ? teamNames.A : teamNames.B}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-[11px] text-slate-400">{entry.timestamp}</span>
                    {isNewest && (
                      <button
                        type="button"
                        onClick={() => undoRecent(entry.recordedEventId)}
                        className="btn-secondary rounded-2xl px-3 py-1 text-xs font-medium text-red-600"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
