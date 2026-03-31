"use client";

import { useMemo, useState } from "react";
import { buildPlatformShareUrls } from "../../lib/share/share";

type ShareSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  shareText: string;
  shareUrl: string;
  isLocalOnly?: boolean;
};

export function ShareSheet({
  isOpen,
  onClose,
  title = "Share",
  shareText,
  shareUrl,
  isLocalOnly = false,
}: ShareSheetProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const platformUrls = useMemo(
    () => buildPlatformShareUrls(shareText, shareUrl),
    [shareText, shareUrl],
  );

  if (!isOpen) {
    return null;
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback("Link copied");
    } catch {
      setFeedback("Could not copy link");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      return;
    }

    try {
      await navigator.share({
        title,
        text: shareText,
        url: shareUrl,
      });
      setFeedback("Shared");
    } catch {
      setFeedback("Share canceled");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share</p>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {isLocalOnly ? "Copy local link" : "Copy Link"}
          </button>
          {!isLocalOnly ? (
            <>
              <a
                href={platformUrls.sms}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Text Message
              </a>
              <a
                href={platformUrls.facebook}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Facebook
              </a>
              <a
                href={platformUrls.x}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                X / Twitter
              </a>
              <a
                href={platformUrls.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:col-span-2"
              >
                WhatsApp
              </a>
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
              Local development link only. Set NEXT_PUBLIC_SITE_URL for production-shareable links.
            </p>
          )}
        </div>

        {!isLocalOnly && typeof navigator !== "undefined" && navigator.share ? (
          <button
            type="button"
            onClick={nativeShare}
            className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Use native share
          </button>
        ) : null}

        {feedback ? <p className="mt-2 text-xs text-slate-500">{feedback}</p> : null}
      </div>
    </div>
  );
}