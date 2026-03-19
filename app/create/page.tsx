"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createGameAction, CreateGameFormState } from "../actions/create-game";

const initialState: CreateGameFormState = {};

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
              Start a game
              <br />
              people actually
              <br />
              want to join.
            </h1>
          </section>

          <section>
            <form action={formAction} className="space-y-5">
              <div>
                <input
                  name="title"
                  required
                  placeholder="Friday Night Bingo"
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

              <div className="grid gap-5 sm:grid-cols-2">
                <select
                  name="mode"
                  defaultValue="quick_play"
                  className="h-16 w-full rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 px-6 text-lg font-medium text-[#2f2925] outline-none transition focus:border-[#9b8c7f] focus:bg-white focus:ring-4 focus:ring-[#d8ccc0]/50"
                >
                  <option value="quick_play">Quick Play</option>
                  <option value="streak">Streak</option>
                </select>

                <select
                  name="visibility"
                  defaultValue="private"
                  className="h-16 w-full rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 px-6 text-lg font-medium text-[#2f2925] outline-none transition focus:border-[#9b8c7f] focus:bg-white focus:ring-4 focus:ring-[#d8ccc0]/50"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <section className="rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a7d71]">
                  Game Mode
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[#3a332e]">Completion mode</p>
                    <div className="mt-2 space-y-2 text-sm text-[#3a332e]">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="completion_mode"
                          value="BLACKOUT"
                          defaultChecked
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Blackout (any order)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="completion_mode"
                          value="STREAK"
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Streak (in order)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#3a332e]">End condition</p>
                    <div className="mt-2 space-y-2 text-sm text-[#3a332e]">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="end_condition"
                          value="FIRST_COMPLETION"
                          defaultChecked
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>First to complete</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="end_condition"
                          value="HOST_DECLARED"
                          className="h-4 w-4 border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                        />
                        <span>Host ends game</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              <label className="flex h-16 items-center justify-between rounded-[1.75rem] border border-[#ddd2c7] bg-white/95 px-6">
                <span className="text-lg font-medium text-[#3a332e]">
                  Allow custom cards
                </span>
                <input
                  type="checkbox"
                  name="allowCustomCards"
                  defaultChecked
                  className="h-5 w-5 rounded border-[#b9aea2] text-[#6f6257] focus:ring-[#cdbfb2]"
                />
              </label>

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