"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  setGameStatusAction,
  type SetGameStatusFormState,
} from "../../../actions/set-game-status";
import {
  shareResults,
  shareInvite,
} from "../../../../lib/share/share";
import { ShareSheet } from "../../../../components/share/ShareSheet";

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
  isFinished?: boolean;
  winnerName?: string | null;
  hostName?: string | null;
  promptInviteOnMount?: boolean;
  consumeJoinQueryOnMount?: boolean;
}

export function ShareGameControl({ slug, title, teamA, teamB, hostName }: ShareGameControlProps) {
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const resolvedTeamA = teamA?.trim() || "Team A";
  const resolvedTeamB = teamB?.trim() || "Team B";
  const invitePath = `/g/${slug}`;
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const inviteShare = shareInvite({ slug, teamA: resolvedTeamA, teamB: resolvedTeamB }, origin);

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share game</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{invitePath}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsShareSheetOpen(true)}
          className="btn-primary rounded-2xl"
        >
          Share game
        </button>
      </div>
      <ShareSheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        title={title}
        shareText={inviteShare.text}
        shareUrl={inviteShare.url}
        isLocalOnly={inviteShare.isLocalOnly}
      />
    </section>
  );
}

export function InlineShareButton({
  slug,
  title,
  teamA,
  teamB,
  isFinished = false,
  winnerName = null,
  promptInviteOnMount = false,
  consumeJoinQueryOnMount = false,
}: InlineShareButtonProps) {
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const resolvedTeamA = teamA?.trim() || "Team A";
  const resolvedTeamB = teamB?.trim() || "Team B";
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const sharePayload = isFinished
    ? shareResults(
        { slug, teamA: resolvedTeamA, teamB: resolvedTeamB },
        { name: winnerName },
        origin,
      )
    : shareInvite({ slug, teamA: resolvedTeamA, teamB: resolvedTeamB }, origin);

  useEffect(() => {
    if (!consumeJoinQueryOnMount) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("joined");
      url.searchParams.delete("jt");
      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextPath);
    } catch {
      // no-op
    }
  }, [consumeJoinQueryOnMount]);

  useEffect(() => {
    if (!promptInviteOnMount) {
      return;
    }

    const storageKey = `bingra-post-join-invite-${slug}`;
    try {
      const alreadyPrompted = window.sessionStorage.getItem(storageKey);
      if (alreadyPrompted) {
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
      setIsShareSheetOpen(true);
    } catch {
      setIsShareSheetOpen(true);
    }
  }, [isFinished, promptInviteOnMount, slug]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsShareSheetOpen(true)}
        className="btn-secondary px-3 py-1.5 text-xs"
      >
        {isFinished ? "Share Results" : "Invite Friends"}
      </button>

      <ShareSheet
        isOpen={isShareSheetOpen}
        onClose={() => setIsShareSheetOpen(false)}
        title={title}
        shareText={sharePayload.text}
        shareUrl={sharePayload.url}
        isLocalOnly={sharePayload.isLocalOnly}
      />
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
