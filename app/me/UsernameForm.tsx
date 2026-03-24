"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateUsernameAction, type UpdateUsernameFormState } from "../actions/update-username";

type UsernameFormProps = {
  initialUsername: string;
};

const initialState: UpdateUsernameFormState = {};

function SaveUsernameButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save username"}
    </button>
  );
}

export function UsernameForm({ initialUsername }: UsernameFormProps) {
  const [state, formAction] = useActionState(updateUsernameAction, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Username
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={state?.username ?? initialUsername}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? "username-error" : undefined}
        />
        <SaveUsernameButton />
      </div>
      {state?.error ? (
        <p id="username-error" className="text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="text-xs font-medium text-emerald-700">Username updated.</p>
      ) : null}
    </form>
  );
}
