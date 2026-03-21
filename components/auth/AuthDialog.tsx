"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type AuthDialogProps = {
  label?: string;
  nextPath: string;
  linkPlayerId?: string;
  emphasis?: "subtle" | "prominent";
};

function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured;
  }

  return window.location.origin;
}

function buildAuthCallbackUrl(nextPath: string, linkPlayerId?: string): string {
  const callbackUrl = new URL("/auth/callback", getAppBaseUrl());
  callbackUrl.searchParams.set("next", nextPath);

  if (linkPlayerId) {
    callbackUrl.searchParams.set("link_player_id", linkPlayerId);
  }

  return callbackUrl.toString();
}

export function AuthDialog({
  label = "Continue with email",
  nextPath,
  linkPlayerId,
  emphasis = "subtle",
}: AuthDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingMagicLink, setPendingMagicLink] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buttonClassName = useMemo(() => {
    if (emphasis === "prominent") {
      return "inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60";
    }

    return "inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800";
  }, [emphasis]);

  const open = () => {
    setIsOpen(true);
    setMessage(null);
    setError(null);
  };

  const close = () => {
    setIsOpen(false);
    setPendingMagicLink(false);
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setPendingMagicLink(true);
    setError(null);
    setMessage(null);

    try {
      const emailRedirectTo = buildAuthCallbackUrl(nextPath, linkPlayerId);
      const supabase = createSupabaseBrowserClient();
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (magicLinkError) {
        throw magicLinkError;
      }

      setMessage("Email sent. Check your inbox for your secure login link.");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to send magic link";
      setError(message);
    } finally {
      setPendingMagicLink(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} className={buttonClassName}>
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Sign in to Bingra</h2>
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                aria-label="Close sign in"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              Guest play stays available. Sign in to save stats and unlock history.
            </p>

            {/*
              TODO(phase-3-phone-auth):
              - A single Supabase user may have multiple credentials (email + phone).
              - Prefer authenticated "add phone" / identity-linking flows so both credentials map
                to one auth.users.id and one profile, instead of creating a second account.
            */}

            <p className="mt-4 text-sm text-slate-600">
              Enter your email and we&apos;ll send you a secure login link.
            </p>
            <input
              id="magic-link-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={pendingMagicLink}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pendingMagicLink ? "Sending..." : "Continue with email"}
            </button>

            {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}