"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { JoinGameFormState } from "../../actions/join-game";

export type JoinPreviewEvent = {
  title: string;
  pointsText: string;
  accentTone: "team" | "neutral";
};

type JoinFormProps = {
  slug: string;
  previewEvents: JoinPreviewEvent[];
  initialDisplayName?: string;
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
      {pending ? "Joining..." : "Get My Card"}
    </button>
  );
}

export function JoinForm({ slug, previewEvents, initialDisplayName = "", action }: JoinFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Example Bingra Card
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 shadow-sm">
          <div className="space-y-2.5">
            {previewEvents.map((event, index) => {
              const toneClass =
                event.accentTone === "team"
                  ? "border-blue-200 border-l-blue-400"
                  : "border-slate-200 border-l-slate-300";

              return (
                <div
                  key={`${event.title}-${index}`}
                  className={`min-h-[86px] rounded-xl border border-l-4 bg-white/90 px-4 py-3 shadow-sm ${toneClass}`}
                >
                  <p className="text-[15px] font-semibold leading-tight text-slate-900">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.pointsText}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          placeholder="Ada Lovelace"
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? "displayName-error" : undefined}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
        />
        <p className="text-xs text-slate-500">This is the name other players will see.</p>
        {state?.error && (
          <p id="displayName-error" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <SubmitButton />
        <div className="space-y-1 text-center text-sm text-slate-500">
          <p>No account required</p>
          <p>Sign in below to track your stats</p>
        </div>
      </div>
    </form>
  );
}
