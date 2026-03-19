"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ScorerParentCategory,
  ScorerSubtypeGroup,
} from "../../../../lib/binga/event-catalog";
import {
  getEventById,
  getScorerEventsForParent,
  getScorerOptionById,
  getScorerParentOptions,
  getScorerSubtypeOptions,
} from "../../../../lib/binga/event-logic";
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
};

type RecentEvent = {
  recordedEventId?: string;
  eventKey?: string;
  label: string;
  team?: string | null;
  timestamp: string;
};

type Stage = "parent" | "event" | "subtype" | "team";

const initialRecordState: RecordEventFormState = {};
const initialDeleteState: DeleteScoredEventFormState = {};

export function HostScoringPanel({ slug, isFinished = false }: HostScoringPanelProps) {
  const router = useRouter();

  const [recordState, recordAction] = useActionState(recordEventAction, initialRecordState);
  const [deleteState, deleteAction] = useActionState(
    deleteScoredEventAction,
    initialDeleteState,
  );

  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [stage, setStage] = useState<Stage>("parent");
  const [parent, setParent] = useState<ScorerParentCategory | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string | null>(null);
  const [selectedSubtypeGroup, setSelectedSubtypeGroup] = useState<ScorerSubtypeGroup | null>(
    null,
  );

  const lastSubmissionRef = useRef<RecentEvent | null>(null);

  const parentOptions = useMemo(() => getScorerParentOptions(), []);
  const eventOptions = useMemo(() => {
    return parent ? getScorerEventsForParent(parent) : [];
  }, [parent]);

  const selectedEventOption = useMemo(() => {
    return selectedEventId ? getScorerOptionById(selectedEventId) : undefined;
  }, [selectedEventId]);

  const selectedSubtypeOption = useMemo(() => {
    return selectedSubtypeId ? getScorerOptionById(selectedSubtypeId) : undefined;
  }, [selectedSubtypeId]);

  const subtypeOptions = useMemo(() => {
    if (!selectedSubtypeGroup) {
      return [];
    }

    return getScorerSubtypeOptions(selectedSubtypeGroup);
  }, [selectedSubtypeGroup]);

  const finalEvent = selectedSubtypeOption ?? selectedEventOption;

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
      setStage("parent");
      setParent(null);
      setSelectedEventId(null);
      setSelectedSubtypeId(null);
      setSelectedSubtypeGroup(null);
      lastSubmissionRef.current = null;
      router.refresh();
    }
  }, [recordState.success, recordState.completedAt, recordState.recordedEventId, router]);

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
    (isFinished ? "Scoring is locked because this game is complete." : undefined);

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

    const resolved = getScorerOptionById(option.id);
    if (!resolved) return;

    setSelectedEventId(resolved.id);
    setSelectedSubtypeId(null);
    setSelectedSubtypeGroup(null);

    if (resolved.requiresTeam) {
      setStage("team");
      return;
    }

    submitEvent(resolved.id, resolved.label, null);
  }

  function handleSubtypeSelect(subtypeId: string) {
    const resolved = getScorerOptionById(subtypeId);
    if (!resolved) return;

    setSelectedSubtypeId(resolved.id);

    if (resolved.requiresTeam) {
      setStage("team");
      return;
    }

    submitEvent(resolved.id, resolved.label, null);
  }

  function handleTeamSelect(team: "A" | "B") {
    if (!finalEvent) return;
    submitEvent(finalEvent.id, finalEvent.label, team);
  }

  function handleBack() {
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
    switch (stage) {
      case "event":
        return parent === "score" ? "Score" : "Change of possession";
      case "subtype":
        return "Made free throw";
      case "team":
        return "Choose team";
      case "parent":
      default:
        return "Record event";
    }
  }

  const showBackButton = !isScoringLocked && stage !== "parent";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Host scoring
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{getTitle()}</h2>
        </div>

        {showBackButton && (
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Back
          </button>
        )}
      </div>

      {recordState.error && <p className="mt-3 text-xs text-red-600">{recordState.error}</p>}
      {deleteState.error && <p className="mt-3 text-xs text-red-600">{deleteState.error}</p>}
      {recordState.success && <p className="mt-3 text-xs text-emerald-600">Recorded.</p>}

      {lockReason && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Scoring locked</p>
          <p className="mt-1 text-xs text-amber-800">{lockReason}</p>
        </div>
      )}

      {!isScoringLocked ? (
        <div className="mt-4">
            {stage === "parent" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {parentOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleParentSelect(option.id)}
                    className="min-h-20 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-left text-base font-semibold text-slate-900 transition hover:border-blue-500 hover:bg-blue-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {stage === "event" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {eventOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleEventSelect(option)}
                    className="min-h-16 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-base font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {stage === "subtype" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {subtypeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSubtypeSelect(option.id)}
                    className="min-h-16 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-base font-medium text-slate-900 transition hover:border-blue-500 hover:bg-blue-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {stage === "team" && (
              <div className="grid grid-cols-2 gap-3">
                {( ["A", "B"] as const ).map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => handleTeamSelect(team)}
                    className="min-h-20 rounded-2xl border border-blue-500 bg-blue-500 px-4 py-5 text-center text-base font-semibold text-white transition hover:bg-blue-600"
                  >
                    Team {team}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
            <p className="font-semibold">Scoring locked</p>
            <p className="mt-1 text-xs text-amber-800">
              {lockReason ?? "This game is complete. New scoring submissions are blocked."}
            </p>
          </div>
        )}

      {recentEvents.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</p>
          <ul className="mt-3 space-y-2">
            {recentEvents.map((entry, index) => {
              const catalogEvent = entry.eventKey ? getEventById(entry.eventKey) : undefined;
              const label = catalogEvent?.label ?? entry.label ?? "Recorded event";
              const isNewest = index === 0 && !!entry.recordedEventId;

              return (
                <li
                  key={`${entry.recordedEventId ?? entry.eventKey ?? entry.label}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{label}</p>
                    {entry.team ? (
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Team {entry.team}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-[11px] text-slate-400">{entry.timestamp}</span>
                    {isNewest && (
                      <button
                        type="button"
                        onClick={() => undoRecent(entry.recordedEventId)}
                        className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-600"
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