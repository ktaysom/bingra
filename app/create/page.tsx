"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createGameAction, CreateGameFormState } from "../actions/create-game";

const initialState: CreateGameFormState = {};
const DEFAULT_ROOM_NAMES = [
  "Friday Night Full-Court",
  "No-Look Bingra League",
  "Fourth Quarter Frenzy",
  "Paint Battle Room",
  "Fastbreak Challenge",
  "Rim Rattle Showdown",
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#6f6257] px-6 text-base font-semibold text-white transition hover:bg-[#62564c] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating game..." : "Create game"}
    </button>
  );
}

export default function CreatePage() {
  const [state, formAction] = useActionState(createGameAction, initialState);

  const [title, setTitle] = useState(() => {
    const daySeed = Math.floor(Date.now() / 86_400_000);
    return DEFAULT_ROOM_NAMES[daySeed % DEFAULT_ROOM_NAMES.length];
  });
  const [teamScope, setTeamScope] = useState<"both_teams" | "team_a_only" | "team_b_only">(
    "both_teams",
  );
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [completionMode, setCompletionMode] = useState<"blackout" | "streak">("blackout");
  const [endCondition, setEndCondition] = useState<"first_to_complete" | "host_ends">(
    "first_to_complete",
  );
  const [eventsPerCard, setEventsPerCard] = useState<6 | 8 | 10 | 12>(8);

  const completionModeDb = completionMode === "streak" ? "STREAK" : "BLACKOUT";
  const endConditionDb =
    endCondition === "host_ends" ? "HOST_DECLARED" : "FIRST_COMPLETION";
  const legacyMode = completionMode === "streak" ? "streak" : "quick_play";
  const safeTeamAName = teamAName.trim() || "Team A";
  const safeTeamBName = teamBName.trim() || "Team B";

  const previewEvents = useMemo(() => {
    if (completionMode === "streak") {
      if (teamScope === "team_a_only") {
        return [
          `${safeTeamAName}: 3PT made`,
          `${safeTeamAName}: Steal`,
          `${safeTeamAName}: Assist`,
          `${safeTeamAName}: Block`,
          `${safeTeamAName}: Bonus FT`,
          `${safeTeamAName}: Offensive rebound`,
        ];
      }

      if (teamScope === "team_b_only") {
        return [
          `${safeTeamBName}: Rebound`,
          `${safeTeamBName}: Block`,
          `${safeTeamBName}: Fast break`,
          `${safeTeamBName}: Bonus FT`,
          `${safeTeamBName}: 3PT made`,
          `${safeTeamBName}: Steal`,
        ];
      }

      return [
        "Either team: 3PT made",
        "Either team: Turnover forced",
        "Either team: Assist",
        "Either team: Bonus FT",
        "Either team: Steal",
        "Either team: Defensive rebound",
      ];
    }

    if (teamScope === "team_a_only") {
      return [
        `${safeTeamAName}: 3PT made`,
        `${safeTeamAName}: Steal`,
        `${safeTeamAName}: Defensive rebound`,
        `${safeTeamAName}: Bonus FT`,
        `${safeTeamAName}: Block`,
        `${safeTeamAName}: Charge taken`,
      ];
    }

    if (teamScope === "team_b_only") {
      return [
        `${safeTeamBName}: Block`,
        `${safeTeamBName}: Fast break`,
        `${safeTeamBName}: Free throw made`,
        `${safeTeamBName}: 3PT made`,
        `${safeTeamBName}: Steal`,
        `${safeTeamBName}: Offensive rebound`,
      ];
    }

    return [
      "Either team: 3PT made",
      "Either team: Assist",
      "Either team: Steal",
      "Either team: Bonus FT",
      "Either team: Rebound",
      "Jump ball call",
    ];
  }, [completionMode, safeTeamAName, safeTeamBName, teamScope]);

  const previewCardEvents = useMemo(() => {
    const required = Math.max(1, eventsPerCard);
    const result: string[] = [];

    for (let i = 0; i < required; i += 1) {
      result.push(previewEvents[i % previewEvents.length]);
    }

    return result;
  }, [eventsPerCard, previewEvents]);

  const scopeLabel =
    teamScope === "team_a_only"
      ? `${safeTeamAName} only`
      : teamScope === "team_b_only"
        ? `${safeTeamBName} only`
        : "Both teams";

  return (
    <main className="min-h-screen bg-[#f5efe6] text-[#2f2925]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="mb-10 flex items-center justify-between">
          <div className="text-2xl font-black tracking-[-0.04em] text-[#2c2622]">
            Bingra
          </div>
          <div className="rounded-full border border-[#b9aea2] bg-white/50 px-4 py-2 text-sm font-medium text-[#5f554d] backdrop-blur-sm">
            New room
          </div>
        </header>

        <div className="grid flex-1 gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7d71]">
              Host setup
            </p>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-[#2c2622] sm:text-6xl lg:text-7xl">
              Every
              <br />
             play
              <br />
              counts.
            </h1>
          </section>

          <section>
            <form action={formAction} className="space-y-5">
              <input type="hidden" name="mode" value={legacyMode} />
              <input type="hidden" name="completion_mode" value={completionModeDb} />
              <input type="hidden" name="end_condition" value={endConditionDb} />
              <input type="hidden" name="visibility" value="private" />
              <input type="hidden" name="allowCustomCards" value="on" />
              <input type="hidden" name="teamScope" value={teamScope} />
              <input type="hidden" name="eventsPerCard" value={String(eventsPerCard)} />

              <div>
                <input
                  name="title"
                  required
                  placeholder="Friday Night Bingra"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-16 w-full rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 px-6 text-xl font-medium text-[#2f2925] placeholder:text-[#a09488] outline-none transition focus:border-[#9b8c7f] focus:bg-white focus:ring-4 focus:ring-[#d8ccc0]/50"
                />
              </div>

              <div>
                <input
                  name="hostDisplayName"
                  required
                  defaultValue="Host"
                  placeholder="Host"
                  className="h-16 w-full rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 px-6 text-xl font-medium text-[#2f2925] placeholder:text-[#a09488] outline-none transition focus:border-[#9b8c7f] focus:bg-white focus:ring-4 focus:ring-[#d8ccc0]/50"
                />
              </div>

              <section className="rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a7d71]">
                  Observed game
                </p>

                <div className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
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
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7d71]">
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

                  <p className="mt-4 text-sm font-semibold text-[#3a332e]">Track events for</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="teamScope"
                        value="both_teams"
                        checked={teamScope === "both_teams"}
                        onChange={() => setTeamScope("both_teams")}
                        className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                      />
                      <span>Both teams</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="teamScope"
                        value="team_a_only"
                        checked={teamScope === "team_a_only"}
                        onChange={() => setTeamScope("team_a_only")}
                        className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                      />
                      <span>{safeTeamAName} only</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="teamScope"
                        value="team_b_only"
                        checked={teamScope === "team_b_only"}
                        onChange={() => setTeamScope("team_b_only")}
                        className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                      />
                      <span>{safeTeamBName} only</span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a7d71]">
                  Card rules
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[#3a332e]">Completion mode</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                        <input
                          type="radio"
                          checked={completionMode === "blackout"}
                          onChange={() => setCompletionMode("blackout")}
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Blackout</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                        <input
                          type="radio"
                          checked={completionMode === "streak"}
                          onChange={() => setCompletionMode("streak")}
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Streak</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#3a332e]">End condition</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                        <input
                          type="radio"
                          checked={endCondition === "first_to_complete"}
                          onChange={() => setEndCondition("first_to_complete")}
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>First to complete</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm">
                        <input
                          type="radio"
                          checked={endCondition === "host_ends"}
                          onChange={() => setEndCondition("host_ends")}
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Host ends game</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#3a332e]">Events per card</p>
                    <div className="mt-2 grid gap-2 grid-cols-4">
                      {([6, 8, 10, 12] as const).map((count) => (
                        <label
                          key={count}
                          className="flex items-center justify-center gap-2 rounded-xl border border-[#ddd2c7] bg-[#f8f3ed] px-3 py-2 text-sm font-semibold"
                        >
                          <input
                            type="radio"
                            name="eventsPerCardOption"
                            value={count}
                            checked={eventsPerCard === count}
                            onChange={() => setEventsPerCard(count)}
                            className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                          />
                          <span>{count}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#d8ccc0] bg-[#fffaf5] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a7d71]">
                  Preview
                </p>
                <div className="mt-3 rounded-xl border border-[#e7dbcf] bg-white p-4">
                  <h3 className="text-lg font-bold text-[#2c2622]">
                    {title.trim() || "Untitled room"}
                  </h3>
                  <p className="mt-1 text-sm text-[#6f6257]">
                    {safeTeamAName} vs {safeTeamBName}
                  </p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-[#eee3d8] bg-[#faf5ef] px-3 py-2">
                      <dt className="font-semibold uppercase tracking-wide text-[#8a7d71]">Track</dt>
                      <dd className="mt-1 text-sm text-[#3a332e]">{scopeLabel}</dd>
                    </div>
                    <div className="rounded-lg border border-[#eee3d8] bg-[#faf5ef] px-3 py-2">
                      <dt className="font-semibold uppercase tracking-wide text-[#8a7d71]">Completion</dt>
                      <dd className="mt-1 text-sm text-[#3a332e]">{completionMode === "blackout" ? "Blackout" : "Streak"}</dd>
                    </div>
                    <div className="rounded-lg border border-[#eee3d8] bg-[#faf5ef] px-3 py-2">
                      <dt className="font-semibold uppercase tracking-wide text-[#8a7d71]">End</dt>
                      <dd className="mt-1 text-sm text-[#3a332e]">
                        {endCondition === "first_to_complete" ? "First to complete" : "Host ends game"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#eee3d8] bg-[#faf5ef] px-3 py-2">
                      <dt className="font-semibold uppercase tracking-wide text-[#8a7d71]">Events/card</dt>
                      <dd className="mt-1 text-sm text-[#3a332e]">{eventsPerCard}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Player card preview
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {completionMode === "streak" ? "Streak order" : "Any order"}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {previewCardEvents.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {completionMode === "streak" ? `${index + 1}. ${item}` : item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {state.error ? (
                <div
                  className="rounded-[1.5rem] border border-[#efc2b8] bg-[#fff1ed] px-5 py-4 text-sm font-medium text-[#8b3c2d]"
                  role="alert"
                >
                  {state.error}
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