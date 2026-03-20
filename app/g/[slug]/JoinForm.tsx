"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { JoinGameFormState } from "../../actions/join-game";

type JoinFormProps = {
  slug: string;
  action: (
    prevState: JoinGameFormState,
    formData: FormData
  ) => Promise<JoinGameFormState>;
};

const initialState: JoinGameFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#2f6df6] px-6 text-base font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Joining..." : "Join game"}
    </button>
  );
}

export function JoinForm({ slug, action }: JoinFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          placeholder="Ada Lovelace"
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? "displayName-error" : undefined}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        />
        {state?.error && (
          <p id="displayName-error" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <SubmitButton />
        <p className="text-center text-sm text-slate-500">No account required</p>
      </div>
    </form>
  );
}
