"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createGameAction, CreateGameFormState } from "../actions/create-game";
import { generateGameName } from "../../lib/bingra/game-name-generator";
import { AuthEntryPoint } from "../../components/auth/AuthEntryPoint";
import { AuthDialog } from "../../components/auth/AuthDialog";
import { BingraLogo } from "../../components/BingraLogo";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  getEventMaxThreshold,
  getEventsForMode,
  type TeamKey,
} from "../../lib/bingra/event-logic";
import { getRequiredCountForThresholdLevel } from "../../lib/bingra/threshold-levels";
import type { GameEventType } from "../../lib/bingra/event-catalog";
import {
  DEFAULT_SPORT_PROFILE,
  SPORT_PROFILES,
  getSportProfileDefinition,
  getSportProfileLabel,
  type SportKey,
  type SportLevel,
  type SportProfileKey,
} from "../../lib/bingra/sport-profiles";
import { mapPlayModeToGameMode } from "../../lib/bingra/types";

const initialState: CreateGameFormState = {};
const CREATE_DRAFT_STORAGE_KEY = "bingra.create-draft.v1";
const CREATE_AFTER_LOGIN_RETRY_KEY = "bingra.create-after-login.retry.v1";
const CREATE_AFTER_LOGIN_RETRY_CONSUMED_KEY = "bingra.create-after-login.retry-consumed.v1";
const CREATE_AUTH_CREATE_TRACE_KEY = "bingra.create-after-login.trace.v1";
const AUTH_REQUIRED_CREATE_ERROR = "Please sign in to create a game.";

const DEFAULT_TITLE = "Game On";

type SelectableSport = SportKey;
type SelectableLevel = SportLevel;

const SPORT_OPTIONS: Array<{ key: SelectableSport; label: string; icon: string }> = [
  { key: "basketball", label: "Basketball", icon: "🏀" },
  { key: "soccer", label: "Soccer", icon: "⚽" },
];

const LEVEL_ORDER: SelectableLevel[] = ["youth", "high_school", "college", "pro"];

const LEVEL_LABELS: Record<SelectableLevel, string> = {
  youth: "Youth",
  high_school: "High School",
  college: "College",
  pro: "Professional",
};

const SPORT_LEVEL_PROFILE_MAP: Record<
  SelectableSport,
  Array<{ level: SelectableLevel; label: string; profile: SportProfileKey }>
> = SPORT_OPTIONS.reduce((acc, sportOption) => {
  acc[sportOption.key] = SPORT_PROFILES
    .filter((profile) => profile.sport === sportOption.key)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
    .map((profile) => ({
      level: profile.level,
      label: LEVEL_LABELS[profile.level],
      profile: profile.key,
    }));

  return acc;
}, {} as Record<SelectableSport, Array<{ level: SelectableLevel; label: string; profile: SportProfileKey }>>);

function resolveSportLevelSelection(profile: SportProfileKey): {
  sport: SelectableSport;
  level: SelectableLevel;
} {
  const profileDefinition = getSportProfileDefinition(profile);
  const sportFromProfile = profileDefinition.sport as SelectableSport;
  const levelFromProfile = profileDefinition.level;

  const sportOptions = SPORT_LEVEL_PROFILE_MAP[sportFromProfile] ?? [];
  const hasLevel = sportOptions.some((option) => option.level === levelFromProfile);
  const fallbackOption = sportOptions[0] ?? SPORT_LEVEL_PROFILE_MAP.basketball[0];

  return {
    sport: sportFromProfile,
    level: hasLevel ? levelFromProfile : fallbackOption.level,
  };
}

function resolveProfileFromSelection(
  sport: SelectableSport,
  level: SelectableLevel,
): SportProfileKey {
  return (
    SPORT_LEVEL_PROFILE_MAP[sport].find((option) => option.level === level)?.profile ??
    SPORT_LEVEL_PROFILE_MAP[sport][0].profile
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary h-14 w-full rounded-2xl px-6 text-base"
    >
      {pending ? "Creating game..." : "Create game"}
    </button>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7d71]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#2c2622]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#6b6159]">{description}</p>
    </div>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-[#8f7f71] bg-[#f7f0e8] shadow-sm"
          : "border-[#ddd2c7] bg-[#faf7f3] hover:border-[#c5b8ab] hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2f2925]">{title}</p>
          <p className="mt-1 text-sm leading-5 text-[#6b6159]">{description}</p>
        </div>
        <div
          className={`mt-0.5 h-4 w-4 rounded-full border ${
            selected ? "border-[#6f6257] bg-[#6f6257]" : "border-[#bfaea0] bg-white"
          }`}
        />
      </div>
    </button>
  );
}

function formatPreviewItem(input: {
  event: GameEventType;
  index: number;
  teamScope: "both_teams" | "team_a_only" | "team_b_only";
  safeTeamAName: string;
  safeTeamBName: string;
  sportProfile: SportProfileKey;
}): string {
  const { event, index, teamScope, safeTeamAName, safeTeamBName, sportProfile } = input;

  const threshold = (index % Math.max(1, getEventMaxThreshold(event))) + 1;
  const requiredCount = getRequiredCountForThresholdLevel(event, sportProfile, threshold);

  let teamKey: TeamKey | null = null;
  if (event.teamScope === "team") {
    if (teamScope === "team_a_only") {
      teamKey = "A";
    } else if (teamScope === "team_b_only") {
      teamKey = "B";
    } else {
      teamKey = index % 2 === 0 ? "A" : "B";
    }
  }

  const teamPrefix = teamKey ? `${teamKey === "A" ? safeTeamAName : safeTeamBName}: ` : "";

  return `${requiredCount}+ ${teamPrefix}${event.label}`;
}

function getDeterministicPreviewItems(input: {
  events: GameEventType[];
  count: number;
  teamScope: "both_teams" | "team_a_only" | "team_b_only";
  safeTeamAName: string;
  safeTeamBName: string;
  sportProfile: SportProfileKey;
}): string[] {
  const { events, count, teamScope, safeTeamAName, safeTeamBName, sportProfile } = input;

  if (events.length === 0 || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const event = events[index % events.length];

    return formatPreviewItem({
      event,
      index,
      teamScope,
      safeTeamAName,
      safeTeamBName,
      sportProfile,
    });
  });
}

export default function CreatePage() {
  const [state, formAction] = useActionState(createGameAction, initialState);
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const submitAttemptedRef = useRef(false);
  const autoRetryTriggeredRef = useRef(false);
  const autoRetryInProgressRef = useRef(false);
  const [autoRetrySignal, setAutoRetrySignal] = useState(0);
  const [authCreateTraceId, setAuthCreateTraceId] = useState("");

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [hostDisplayName, setHostDisplayName] = useState("Host");

  useEffect(() => {
    setTitle((current) => (current === DEFAULT_TITLE ? generateGameName() : current));
  }, []);

  const [teamScope, setTeamScope] = useState<"both_teams" | "team_a_only" | "team_b_only">(
    "both_teams",
  );
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [completionMode, setCompletionMode] = useState<"blackout" | "streak">("blackout");
  const [endCondition, setEndCondition] = useState<"first_to_complete" | "host_ends">(
    "first_to_complete",
  );
  const [eventsPerCard, setEventsPerCard] = useState(5);
  const [sportProfile, setSportProfile] = useState<SportProfileKey>(DEFAULT_SPORT_PROFILE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const traceRaw = window.sessionStorage.getItem(CREATE_AUTH_CREATE_TRACE_KEY);
    if (!traceRaw) {
      return;
    }

    try {
      const trace = JSON.parse(traceRaw) as {
        traceId?: string;
        verifyClickAt?: number;
        verifySuccessAt?: number;
        redirectStartAt?: number;
      };

      if (trace.traceId) {
        setAuthCreateTraceId(trace.traceId);
      }

    } catch {
      // Ignore malformed trace payloads.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        title?: string;
        hostDisplayName?: string;
        teamScope?: "both_teams" | "team_a_only" | "team_b_only";
        teamAName?: string;
        teamBName?: string;
        completionMode?: "blackout" | "streak";
        endCondition?: "first_to_complete" | "host_ends";
        eventsPerCard?: number;
        sportProfile?: SportProfileKey;
      };

      if (draft.title) setTitle(draft.title);
      if (draft.hostDisplayName) setHostDisplayName(draft.hostDisplayName);
      if (draft.teamScope) setTeamScope(draft.teamScope);
      if (draft.teamAName) setTeamAName(draft.teamAName);
      if (draft.teamBName) setTeamBName(draft.teamBName);
      if (draft.completionMode) setCompletionMode(draft.completionMode);
      if (draft.endCondition) setEndCondition(draft.endCondition);
      if (typeof draft.eventsPerCard === "number") setEventsPerCard(draft.eventsPerCard);
      if (draft.sportProfile) setSportProfile(draft.sportProfile);
    } catch {
      // Ignore malformed drafts.
    } finally {
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      title,
      hostDisplayName,
      teamScope,
      teamAName,
      teamBName,
      completionMode,
      endCondition,
      eventsPerCard,
      sportProfile,
    };

    window.localStorage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [
    title,
    hostDisplayName,
    teamScope,
    teamAName,
    teamBName,
    completionMode,
    endCondition,
    eventsPerCard,
    sportProfile,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (state.error !== AUTH_REQUIRED_CREATE_ERROR) {
      return;
    }

    if (!submitAttemptedRef.current || autoRetryInProgressRef.current) {
      return;
    }

    if (window.sessionStorage.getItem(CREATE_AFTER_LOGIN_RETRY_CONSUMED_KEY) === "1") {
      return;
    }

    window.sessionStorage.setItem(CREATE_AFTER_LOGIN_RETRY_KEY, "1");
    setAutoRetrySignal((current) => current + 1);
  }, [state.error]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const retryFlag = window.sessionStorage.getItem(CREATE_AFTER_LOGIN_RETRY_KEY);
    const consumedFlag = window.sessionStorage.getItem(CREATE_AFTER_LOGIN_RETRY_CONSUMED_KEY);
    const traceRaw = window.sessionStorage.getItem(CREATE_AUTH_CREATE_TRACE_KEY);
    const trace = traceRaw
      ? (JSON.parse(traceRaw) as {
          traceId?: string;
        })
      : null;
    if (autoRetryTriggeredRef.current) {
      return;
    }

    if (retryFlag !== "1") {
      return;
    }

    if (consumedFlag === "1") {
      return;
    }

    const form = createFormRef.current;
    if (!form) {
      return;
    }

    let cancelled = false;
    let submitted = false;
    let pollTimer: number | null = null;
    let pollAttempt = 0;
    const maxPollAttempts = 20;

    const consumeAndSubmit = () => {
      if (submitted || cancelled) {
        return;
      }

      submitted = true;
      autoRetryTriggeredRef.current = true;
      autoRetryInProgressRef.current = true;
      window.sessionStorage.setItem(CREATE_AFTER_LOGIN_RETRY_CONSUMED_KEY, "1");
      window.sessionStorage.removeItem(CREATE_AFTER_LOGIN_RETRY_KEY);
      form.requestSubmit();
    };

    const supabase = createSupabaseBrowserClient();

    const maybeAutoRetryAfterAuth = async (source: "initial" | "auth_change" | "poll") => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.info("[auth][create] auto-retry auth probe", {
        source,
        hasUser: Boolean(user?.id),
        userId: user?.id ?? null,
      });

      if (cancelled) {
        return;
      }

      if (!user?.id) {
        if (pollAttempt < maxPollAttempts) {
          const nextAttempt = pollAttempt + 1;
          pollAttempt = nextAttempt;
          pollTimer = window.setTimeout(() => {
            void maybeAutoRetryAfterAuth("poll");
          }, 300);
        }
        return;
      }

      consumeAndSubmit();
    };

    void maybeAutoRetryAfterAuth("initial");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[auth][create] onAuthStateChange", {
        event,
        hasSessionUser: Boolean(session?.user?.id),
        userId: session?.user?.id ?? null,
      });

      if (!session?.user?.id) {
        return;
      }

      void maybeAutoRetryAfterAuth("auth_change");
    });

    return () => {
      cancelled = true;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
      subscription.unsubscribe();
    };
  }, [autoRetrySignal]);

  useEffect(() => {
    if (autoRetryInProgressRef.current && state.error) {
      autoRetryInProgressRef.current = false;
    }
  }, [state.error]);

  const { sport: selectedSportForPicker, level: selectedLevelForPicker } =
    resolveSportLevelSelection(sportProfile);
  const selectedLevelOptions = SPORT_LEVEL_PROFILE_MAP[selectedSportForPicker];

  const completionModeDb = completionMode === "streak" ? "STREAK" : "BLACKOUT";
  const endConditionDb =
    endCondition === "host_ends" ? "HOST_DECLARED" : "FIRST_COMPLETION";
  const legacyMode = completionMode === "streak" ? "streak" : "quick_play";

  const safeTeamAName = teamAName.trim() || "Team A";
  const safeTeamBName = teamBName.trim() || "Team B";
  const safeTitle = title.trim() || "Untitled room";
  const selectedSport = getSportProfileDefinition(sportProfile).sport;
  const sportProfileLabel = getSportProfileLabel(sportProfile);

  const scopeLabel =
    teamScope === "team_a_only"
      ? `${safeTeamAName} only`
      : teamScope === "team_b_only"
        ? `${safeTeamBName} only`
        : "Both teams";

  // IMPORTANT: Must remain deterministic for SSR hydration
  const previewCardEvents = useMemo(() => {
    const availableEvents = getEventsForMode(mapPlayModeToGameMode(legacyMode), sportProfile)
      .filter((event) => (teamScope === "both_teams" ? true : event.teamScope === "team"))
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

    return getDeterministicPreviewItems({
      events: availableEvents,
      count: eventsPerCard,
      teamScope,
      safeTeamAName,
      safeTeamBName,
      sportProfile,
    });
  }, [eventsPerCard, legacyMode, safeTeamAName, safeTeamBName, sportProfile, teamScope]);

  return (
    <main className="min-h-screen text-[#2f2925]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 md:py-10">
        <header className="mb-10 rounded-2xl bg-bingra-dark px-4 py-3 shadow-sm sm:px-5 sm:py-3.5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Bingra home">
              <BingraLogo variant="horizontal" className="h-16 w-auto" />
            </Link>
            <AuthEntryPoint nextPath="/create" subtle />
          </div>
        </header>

        <div className="grid flex-1 gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <section className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7d71]">
              Host setup
            </p>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-[#2c2622] sm:text-6xl lg:text-7xl">
              Build the
              <br />
              game before
              <br />
              game time.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#6b6159]">
              Pick which game events to track, how players complete their cards, and how many events
              each player card should include.
            </p>
          </section>

          <section>
            <form
              ref={createFormRef}
              action={formAction}
              onSubmit={() => {
                submitAttemptedRef.current = true;

                if (typeof window !== "undefined" && !autoRetryInProgressRef.current) {
                  window.sessionStorage.removeItem(CREATE_AFTER_LOGIN_RETRY_CONSUMED_KEY);
                }
              }}
              className="space-y-6"
            >
              <input type="hidden" name="mode" value={legacyMode} />
              <input type="hidden" name="completion_mode" value={completionModeDb} />
              <input type="hidden" name="end_condition" value={endConditionDb} />
              <input type="hidden" name="visibility" value="private" />
              <input type="hidden" name="allowCustomCards" value="on" />
              <input type="hidden" name="eventsPerCard" value={String(eventsPerCard)} />
              <input type="hidden" name="sport_profile" value={sportProfile} />
              <input type="hidden" name="auth_create_trace_id" value={authCreateTraceId} />

              <div className="rounded-2xl bg-white/90 p-5 shadow-sm">
                <SectionHeader
                  eyebrow=""
                  title="Name your Bingra"
                  description=""
                />

                <div className="space-y-3">
                  <input
                    name="title"
                    required
                    placeholder="Friday Night Bingra"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="h-16 w-full rounded-[1.25rem] border border-[#ddd2c7] bg-white px-5 text-lg font-medium text-[#2f2925] placeholder:text-[#a09488] outline-none transition focus:border-[#9b8c7f] focus:ring-4 focus:ring-[#d8ccc0]/50"
                  />

                  <input
                    name="hostDisplayName"
                    required
                    value={hostDisplayName}
                    onChange={(event) => setHostDisplayName(event.target.value)}
                    placeholder="Host"
                    className="h-14 w-full rounded-[1.25rem] border border-[#ddd2c7] bg-white px-5 text-base font-medium text-[#2f2925] placeholder:text-[#a09488] outline-none transition focus:border-[#9b8c7f] focus:ring-4 focus:ring-[#d8ccc0]/50"
                  />
                </div>
              </div>

              <section className="rounded-2xl bg-white/90 p-5 shadow-sm">
                <SectionHeader
                  eyebrow="Sport profile"
                  title="League rules"
                  description="Choose which sport ruleset to use for scoring and event balancing."
                />

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
                    1) Choose sport
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SPORT_OPTIONS.map((sport) => {
                      const selected = selectedSportForPicker === sport.key;

                      return (
                        <button
                          key={sport.key}
                          type="button"
                          onClick={() => {
                            const nextProfile = resolveProfileFromSelection(
                              sport.key,
                              selectedLevelForPicker,
                            );
                            setSportProfile(nextProfile);
                          }}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925] shadow-sm"
                              : "border-[#ddd2c7] bg-[#faf7f3] text-[#5c544d] hover:border-[#c5b8ab] hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl" aria-hidden>
                              {sport.icon}
                            </span>
                            <span className="text-base font-semibold">{sport.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
                    2) Choose level
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                    {selectedLevelOptions.map((option) => {
                      const selected = sportProfile === option.profile;

                      return (
                        <button
                          key={option.profile}
                          type="button"
                          onClick={() => setSportProfile(option.profile)}
                          className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                            selected
                              ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925]"
                              : "border-[#ddd2c7] bg-[#faf7f3] text-[#5c544d] hover:border-[#c5b8ab] hover:bg-white"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white/90 p-5 shadow-sm">
                <SectionHeader
                  eyebrow=""
                  title="Which game are we watching?"
                  description=""
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
                      Team A name
                    </label>
                    <input
                      name="teamAName"
                      value={teamAName}
                      onChange={(event) => setTeamAName(event.target.value)}
                      className="h-12 w-full rounded-xl border border-[#ddd2c7] bg-white px-4 text-sm font-medium text-[#2f2925] outline-none transition focus:border-[#9b8c7f] focus:ring-4 focus:ring-[#d8ccc0]/50"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
                      Team B name
                    </label>
                    <input
                      name="teamBName"
                      value={teamBName}
                      onChange={(event) => setTeamBName(event.target.value)}
                      className="h-12 w-full rounded-xl border border-[#ddd2c7] bg-white px-4 text-sm font-medium text-[#2f2925] outline-none transition focus:border-[#9b8c7f] focus:ring-4 focus:ring-[#d8ccc0]/50"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-[#3a332e]">Events can come from</p>
                  <p className="mt-1 text-sm text-[#6b6159]">
                    Will your Bingra game track plays by both teams or just one?.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <input
                        type="radio"
                        name="teamScope"
                        value="both_teams"
                        checked={teamScope === "both_teams"}
                        onChange={() => setTeamScope("both_teams")}
                        className="sr-only"
                      />
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          teamScope === "both_teams"
                            ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925]"
                            : "border-[#ddd2c7] bg-[#faf7f3] text-[#5c544d]"
                        }`}
                      >
                        Both teams
                      </div>
                    </label>

                    <label className="block">
                      <input
                        type="radio"
                        name="teamScope"
                        value="team_a_only"
                        checked={teamScope === "team_a_only"}
                        onChange={() => setTeamScope("team_a_only")}
                        className="sr-only"
                      />
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          teamScope === "team_a_only"
                            ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925]"
                            : "border-[#ddd2c7] bg-[#faf7f3] text-[#5c544d]"
                        }`}
                      >
                        {safeTeamAName} only
                      </div>
                    </label>

                    <label className="block">
                      <input
                        type="radio"
                        name="teamScope"
                        value="team_b_only"
                        checked={teamScope === "team_b_only"}
                        onChange={() => setTeamScope("team_b_only")}
                        className="sr-only"
                      />
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          teamScope === "team_b_only"
                            ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925]"
                            : "border-[#ddd2c7] bg-[#faf7f3] text-[#5c544d]"
                        }`}
                      >
                        {safeTeamBName} only
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white/90 p-5 shadow-sm">
  <SectionHeader
    eyebrow="Card rules"
    title="How do players win?"
    description="Choose how players earn points, when Bingra can end the game, and how many events each card includes."
  />

  <div className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-[#3a332e]">Completion style</p>
      <p className="mt-1 text-sm text-[#6b6159]">
        Decide whether players can mark events in any order or must follow the card from top to bottom.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={completionMode === "blackout"}
          title="Blackout"
          description="Players can complete their whole card in any order."
          onClick={() => setCompletionMode("blackout")}
        />
        <ChoiceCard
          selected={completionMode === "streak"}
          title="Streak"
          description="Players must complete events in the listed order."
          onClick={() => setCompletionMode("streak")}
        />
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#3a332e]">When the game ends</p>
      <p className="mt-1 text-sm text-[#6b6159]">
        Bingra means a full completed card and doubles that player's points. Choose whether the game should auto-end on first Bingra, or only end when the host ends it manually.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={endCondition === "first_to_complete"}
          title="End on first Bingra"
          description="Game ends automatically when the first Bingra happens; host can still end the game manually at any time while live."
          onClick={() => setEndCondition("first_to_complete")}
        />
        <ChoiceCard
          selected={endCondition === "host_ends"}
          title="Host ends game"
          description="Keep playing until the host ends the game manually."
          onClick={() => setEndCondition("host_ends")}
        />
      </div>
    </div>

    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#3a332e]">Events per card</p>
          <p className="mt-1 text-sm text-[#6b6159]">
            More events makes cards harder to complete.
          </p>
        </div>
        <div className="rounded-full border border-[#d9cdc1] bg-[#faf6f1] px-4 py-2 text-sm font-semibold text-[#2f2925]">
          {eventsPerCard} events
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((value) => {
          const active = value === eventsPerCard;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setEventsPerCard(value)}
              className={`rounded-xl border py-2 text-sm font-semibold transition ${
                active
                  ? "border-[#8f7f71] bg-[#f7f0e8] text-[#2f2925]"
                  : "border-[#ddd2c7] bg-[#faf7f3] text-[#6b6159] hover:border-[#c5b8ab] hover:bg-white"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  </div>
</section>

              <section className="rounded-2xl bg-white/90 p-5 shadow-sm">
                <SectionHeader
                  eyebrow="Preview"
                  title="Player card preview"
                  description=""
                />

                <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold tracking-[-0.03em] text-[#2c2622]">
                        {safeTitle}
                      </p>
                      <p className="mt-1 text-sm text-[#6f6257]">
                        {safeTeamAName} vs {safeTeamBName}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f4ece3] px-3 py-1 text-xs font-semibold text-[#5d534b]">
                        {sportProfileLabel}
                      </span>
                      <span className="rounded-full bg-[#f4ece3] px-3 py-1 text-xs font-semibold text-[#5d534b]">
                        {scopeLabel}
                      </span>
                      <span className="rounded-full bg-[#f4ece3] px-3 py-1 text-xs font-semibold text-[#5d534b]">
                        {completionMode === "streak" ? "In order" : "Any order"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {previewCardEvents.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d8ccc0] bg-white text-[11px] font-bold text-[#6f6257]">
                            {completionMode === "streak" ? index + 1 : ""}
                          </div>
                          <p className="text-sm font-semibold leading-5 text-[#2f2925]">{item}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {state.error ? (
                <div
                  className="rounded-[1.5rem] border border-[#efc2b8] bg-[#fff1ed] px-5 py-4 text-sm font-medium text-[#8b3c2d]"
                  role="alert"
                >
                  {state.error}
                  {state.error === AUTH_REQUIRED_CREATE_ERROR ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <div>
                        <AuthDialog
                          label="Sign in to continue"
                          nextPath="/create"
                          emphasis="prominent"
                        />
                      </div>
                      <p className="text-xs text-[#8b3c2d]">
                        After sign-in, we&apos;ll auto-retry creating this game.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="pt-2">
                <SubmitButton />
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}