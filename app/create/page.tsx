"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createGameAction, CreateGameFormState } from "../actions/create-game";

const initialState: CreateGameFormState = {};

const DEFAULT_ROOM_NAMES = [
  "Friday Night Full-Court",
  "No-Look Bingra",
  "Fourth Quarter Frenzy",
  "Paint Battle",
  "Fastbreak Run",
  "Rim Rattle",
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#2f6df6] px-6 text-base font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda] disabled:cursor-not-allowed disabled:opacity-50"
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
  const [eventsPerCard, setEventsPerCard] = useState(9);

  const completionModeDb = completionMode === "streak" ? "STREAK" : "BLACKOUT";
  const endConditionDb =
    endCondition === "host_ends" ? "HOST_DECLARED" : "FIRST_COMPLETION";
  const legacyMode = completionMode === "streak" ? "streak" : "quick_play";

  const safeTeamAName = teamAName.trim() || "Team A";
  const safeTeamBName = teamBName.trim() || "Team B";
  const safeTitle = title.trim() || "Untitled room";

  const scopeLabel =
    teamScope === "team_a_only"
      ? `${safeTeamAName} only`
      : teamScope === "team_b_only"
        ? `${safeTeamBName} only`
        : "Both teams";

  const previewPool = useMemo(() => {
    if (completionMode === "streak") {
      if (teamScope === "team_a_only") {
        return [
          "3PT made",
          "Steal",
          "Assist",
          "Block",
          "Bonus FT made",
          "Offensive rebound",
          "Charge taken",
          "Banked shot",
          "And-1",
          "Jump ball won",
          "Fast break finish",
        ];
      }

      if (teamScope === "team_b_only") {
        return [
          "Defensive rebound",
          "Block",
          "Steal",
          "3PT made",
          "Free throw made",
          "Fast break finish",
          "Charge taken",
          "Banked shot",
          "And-1",
          "Jump ball won",
          "Bonus FT made",
        ];
      }

      return [
        "3PT made",
        "Steal",
        "Assist",
        "Bonus FT made",
        "Defensive rebound",
        "Blocked shot",
        "Charge taken",
        "Banked shot",
        "And-1",
        "Jump ball",
        "Free throw made",
      ];
    }

    if (teamScope === "team_a_only") {
      return [
        "3PT made",
        "Steal",
        "Defensive rebound",
        "Bonus FT made",
        "Blocked shot",
        "Charge taken",
        "Assist",
        "Banked shot",
        "And-1",
        "Jump ball won",
        "Fast break finish",
      ];
    }

    if (teamScope === "team_b_only") {
      return [
        "Blocked shot",
        "Fast break finish",
        "Free throw made",
        "3PT made",
        "Steal",
        "Offensive rebound",
        "Assist",
        "Charge taken",
        "And-1",
        "Jump ball won",
        "Banked shot",
      ];
    }

    return [
      "3PT made",
      "Assist",
      "Steal",
      "Bonus FT made",
      "Rebound",
      "Jump ball",
      "Blocked shot",
      "Charge taken",
      "Free throw made",
      "Banked shot",
      "And-1",
    ];
  }, [completionMode, teamScope]);

  const previewCardEvents = useMemo(() => {
    return Array.from({ length: eventsPerCard }, (_, index) => previewPool[index % previewPool.length]);
  }, [eventsPerCard, previewPool]);

  const previewColumns =
    eventsPerCard <= 7 ? "grid-cols-2" : eventsPerCard <= 10 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3";

  return (
    <main className="min-h-screen text-[#2f2925]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 md:py-10">
        <header className="mb-10">
          <div className="text-2xl font-black tracking-[-0.04em] text-[#2c2622]">Bingra</div>
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
              tip-off.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#6b6159]">
              Pick which game events to track, how players complete their cards, and how many events
              each player card should include.
            </p>
          </section>

          <section>
            <form action={formAction} className="space-y-6">
              <input type="hidden" name="mode" value={legacyMode} />
              <input type="hidden" name="completion_mode" value={completionModeDb} />
              <input type="hidden" name="end_condition" value={endConditionDb} />
              <input type="hidden" name="visibility" value="private" />
              <input type="hidden" name="allowCustomCards" value="on" />
              <input type="hidden" name="eventsPerCard" value={String(eventsPerCard)} />

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
                    defaultValue="Host"
                    placeholder="Host"
                    className="h-14 w-full rounded-[1.25rem] border border-[#ddd2c7] bg-white px-5 text-base font-medium text-[#2f2925] placeholder:text-[#a09488] outline-none transition focus:border-[#9b8c7f] focus:ring-4 focus:ring-[#d8ccc0]/50"
                  />
                </div>
              </div>

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
    description="Choose how players complete their cards, when the Bingra ends, and how many events each card includes."
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
        Choose whether the room ends immediately when someone finishes or stays open through the full game.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={endCondition === "first_to_complete"}
          title="First completion wins"
          description="End the game as soon as a player finishes their card."
          onClick={() => setEndCondition("first_to_complete")}
        />
        <ChoiceCard
          selected={endCondition === "host_ends"}
          title="Full game counts"
          description="Keep Bingra open until the observed game is over."
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

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((value) => {
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
                        {scopeLabel}
                      </span>
                      <span className="rounded-full bg-[#f4ece3] px-3 py-1 text-xs font-semibold text-[#5d534b]">
                        {completionMode === "streak" ? "In order" : "Any order"}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-4 grid gap-3 ${previewColumns}`}>
                    {previewCardEvents.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-2xl bg-white/90 px-4 py-4 shadow-sm"
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