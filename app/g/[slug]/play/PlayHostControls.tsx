"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  setGameStatusAction,
  type SetGameStatusFormState,
} from "../../../actions/set-game-status";

type ShareGameControlProps = {
  slug: string;
  title: string;
};

export function ShareGameControl({ slug, title }: ShareGameControlProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const invitePath = `/g/${slug}`;

  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}${invitePath}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: "Join my game",
          url: inviteUrl,
        });
        setFeedback("Shared");
        return;
      }

      await navigator.clipboard.writeText(inviteUrl);
      setFeedback("Invite link copied");
    } catch {
      setFeedback("Unable to share right now");
    }
  };

  return (
    <section className="rounded-2xl bg-white/90 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share game</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{invitePath}</p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center rounded-2xl bg-[#2f6df6] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda]"
        >
          Share game
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-slate-500">{feedback}</p>}
    </section>
  );
}

type GameStatusActionButtonProps = {
  slug: string;
  intent: "start" | "end";
  children: ReactNode;
  className?: string;
};

const initialState: SetGameStatusFormState = {};

export function GameStatusActionButton({ slug, intent, children, className }: GameStatusActionButtonProps) {
  const [state, action] = useActionState(setGameStatusAction, initialState);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.success && state.completedAt) {
      router.refresh();
    }
  }, [router, state.completedAt, state.success]);

  const handleClick = () => {
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("intent", intent);

    startTransition(() => {
      action(formData);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center justify-center rounded-2xl bg-[#2f6df6] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda] disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      >
        {isPending ? "Saving..." : children}
      </button>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

type EndGameControlProps = {
  slug: string;
};

export function EndGameControl({ slug }: EndGameControlProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="inline-flex items-center justify-center rounded-2xl bg-[#2f6df6] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:bg-[#295fda]"
      >
        End game
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm sm:p-6">
      <p className="font-semibold">Ending the game cannot be undone.</p>
      <p className="mt-1 text-xs text-amber-800">
        Are you sure you want to end it now? Winner will be based on highest final score (Bingra doubles points), not who got first Bingra.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all duration-150 hover:scale-[1.02]"
        >
          Cancel
        </button>
        <GameStatusActionButton
          slug={slug}
          intent="end"
          className="bg-red-600 hover:bg-red-700"
        >
          Yes, end game
        </GameStatusActionButton>
      </div>
    </section>
  );
}
