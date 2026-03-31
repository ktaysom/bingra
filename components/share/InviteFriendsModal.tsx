"use client";

import { useMemo, useState } from "react";
import {
  buildPreferredShareUrl,
  buildGameUrl,
  buildInviteMessage,
  buildInviteShareText,
  getPublicBaseUrl,
} from "../../lib/share/share";
import { ShareSheet } from "./ShareSheet";

type InviteFriendsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  teamA: string;
  teamB: string;
};

export function InviteFriendsModal({ isOpen, onClose, slug, teamA, teamB }: InviteFriendsModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const { gameUrl, isLocalOnly } = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : getPublicBaseUrl();
    const preferred = buildPreferredShareUrl(slug, origin);

    return {
      gameUrl: preferred ?? buildGameUrl(slug, origin),
      isLocalOnly: !preferred,
    };
  }, [slug]);

  const inviteText = useMemo(() => buildInviteShareText(teamA, teamB), [teamA, teamB]);
  const inviteMessage = useMemo(() => buildInviteMessage(teamA, teamB, gameUrl), [teamA, teamB, gameUrl]);

  if (!isOpen) {
    return null;
  }

  const copyInviteMessage = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setFeedback("Invite message copied");
    } catch {
      setFeedback("Could not copy invite message");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
        <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-5 shadow-2xl sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Invite friends</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">Bring your group in</h3>
          <p className="mt-2 text-sm text-slate-600">Share this game with one tap, then race to Bingra.</p>

          <button
            type="button"
            onClick={copyInviteMessage}
            className="mt-4 w-full rounded-2xl bg-violet-600 px-4 py-4 text-base font-bold text-white shadow-md shadow-violet-400/40 transition hover:bg-violet-500"
          >
            Copy Invite Message
          </button>

          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {inviteText}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShareSheetOpen(true)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              More share options
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          {feedback ? <p className="mt-2 text-xs text-slate-500">{feedback}</p> : null}
        </div>
      </div>

      <ShareSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        title="Invite friends"
        shareText={inviteText}
        shareUrl={gameUrl}
        isLocalOnly={isLocalOnly}
      />
    </>
  );
}