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
  teamA?: string | null;
  teamB?: string | null;
  hostName?: string | null;
};

type InlineShareButtonProps = {
  slug: string;
  title: string;
  teamA?: string | null;
  teamB?: string | null;
  hostName?: string | null;
};

function buildShareText({
  teamA,
  teamB,
  hostName,
}: {
  teamA?: string | null;
  teamB?: string | null;
  hostName?: string | null;
}) {
  const hasTeams = teamA && teamB;
  const hasHost = hostName;

  if (hasTeams && hasHost) {
    return `Join my ${teamA} vs ${teamB} Bingra, hosted by ${hostName}`;
  }

  if (hasTeams) {
    return `Join my ${teamA} vs ${teamB} Bingra`;
  }

  if (hasHost) {
    return `Join my Bingra, hosted by ${hostName}`;
  }

  return "Join my Bingra";
}

function useShareGame(
  slug: string,
  title: string,
  {
    teamA,
    teamB,
    hostName,
  }: {
    teamA?: string | null;
    teamB?: string | null;
    hostName?: string | null;
  },
) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const invitePath = `/g/${slug}`;

  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}${invitePath}`;
    const shareText = buildShareText({ teamA, teamB, hostName });
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareText || title,
          text: shareText,
          url: inviteUrl,
        });
        setFeedback("Shared");
        return;
      }

      await navigator.clipboard.writeText(`${shareText} ${inviteUrl}`);
      setFeedback("Invite link copied");
    } catch {
      setFeedback("Unable to share right now");
    }
  };

  return {
    feedback,
    invitePath,
    handleShare,
  };
}

export function ShareGameControl({ slug, title, teamA, teamB, hostName }: ShareGameControlProps) {
  const { feedback, invitePath, handleShare } = useShareGame(slug, title, {
    teamA,
    teamB,
    hostName,
  });

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share game</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{invitePath}</p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="btn-primary rounded-2xl"
        >
          Share game
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-slate-500">{feedback}</p>}
    </section>
  );
}

export function InlineShareButton({ slug, title, teamA, teamB, hostName }: InlineShareButtonProps) {
  const { feedback, handleShare } = useShareGame(slug, title, {
    teamA,
    teamB,
    hostName,
  });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="btn-secondary px-3 py-1.5 text-xs"
      >
        Share
      </button>
      {feedback && <p className="text-xs text-slate-500">{feedback}</p>}
    </div>
  );
}

type GameStatusActionButtonProps = {
  slug: string;
  intent: "start" | "end";
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
};

const initialState: SetGameStatusFormState = {};

export function GameStatusActionButton({
  slug,
  intent,
  children,
  className,
  disabled = false,
  disabledReason,
}: GameStatusActionButtonProps) {
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
        disabled={isPending || disabled}
        className={`btn-primary rounded-2xl ${className ?? ""}`}
      >
        {isPending ? "Saving..." : children}
      </button>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {!state.error && disabled && disabledReason && (
        <p className="mt-2 text-xs text-amber-700">{disabledReason}</p>
      )}
    </div>
  );
}

type EndGameControlProps = {
  slug: string;
  canManageRestrictedScoring?: boolean;
};

export function EndGameControl({ slug, canManageRestrictedScoring = true }: EndGameControlProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!canManageRestrictedScoring) {
    return (
      <section className="surface-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:p-6">
        <p className="font-semibold">Only the host can end this game.</p>
      </section>
    );
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="btn-primary rounded-2xl"
      >
        End game
      </button>
    );
  }

  return (
    <section className="surface-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:p-6">
      <p className="font-semibold">Ending the game cannot be undone.</p>
      <p className="mt-1 text-xs text-amber-800">
        Are you sure you want to end it now? Winner will be based on highest final score (Bingra doubles points), not who got first Bingra.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="btn-secondary rounded-2xl px-4 py-2 text-xs"
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
