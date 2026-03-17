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
      className="w-full rounded-lg bg-black px-4 py-2 text-white font-semibold disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Creating..." : "Create Game"}
    </button>
  );
}

export default function CreatePage() {
  const [state, formAction] = useActionState(createGameAction, initialState);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Binga</p>
        <h1 className="text-3xl font-semibold">Create a game</h1>
        <p className="text-sm text-slate-500">All fields map directly to the live database contract.</p>
      </header>

      <form action={formAction} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          <span>Title</span>
          <input
            name="title"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Friday Night Bingo"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Host display name</span>
          <input
            name="hostDisplayName"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Host"
            defaultValue="Host"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Mode</span>
          <select
            name="mode"
            defaultValue="quick_play"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="quick_play">Quick Play</option>
            <option value="streak">Streak</option>
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Visibility</span>
          <select
            name="visibility"
            defaultValue="private"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="allowCustomCards"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
          />
          <span>Allow custom cards</span>
        </label>

        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </main>
  );
}