"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import {
  buildAuthConfirmPath,
  buildFinalizePath,
  normalizePendingAuthContext,
  savePendingAuthContext,
} from "../../lib/auth/auth-redirect";

const DEFAULT_EMAIL_OTP_LENGTH = 8;

function getExpectedEmailOtpLength(): number {
  const configured = Number(process.env.NEXT_PUBLIC_EMAIL_OTP_LENGTH);
  if (Number.isInteger(configured) && configured >= 4 && configured <= 12) {
    return configured;
  }

  return DEFAULT_EMAIL_OTP_LENGTH;
}

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

export function AuthDialog({
  label = "Sign in",
  nextPath,
  linkPlayerId,
  emphasis = "subtle",
}: AuthDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingMagicLink, setPendingMagicLink] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [pendingEmailOtpVerify, setPendingEmailOtpVerify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expectedEmailOtpLength = getExpectedEmailOtpLength();

  const pendingContext = normalizePendingAuthContext({
    nextPath,
    linkPlayerId,
    playerId: linkPlayerId,
    intent: linkPlayerId ? "save_stats" : "sign_in",
  });

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
    setPendingEmailOtpVerify(false);
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
      savePendingAuthContext(pendingContext);
      const emailRedirectTo = new URL(buildAuthConfirmPath(pendingContext), getAppBaseUrl()).toString();

      console.info("[auth/init] starting email link sign-in", {
        nextPath: pendingContext.nextPath,
        hasLinkPlayerId: Boolean(pendingContext.linkPlayerId),
        intent: pendingContext.intent ?? null,
      });

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

      setMessage(
        `Email sent. Check your inbox for your secure login link or enter the ${expectedEmailOtpLength}-digit code.`,
      );
      console.info("[auth/init] email link/otp sent");
    } catch (authError) {
      const nextError = authError instanceof Error ? authError.message : "Unable to send sign-in email";
      setError(nextError);
      console.error("[auth/init] email sign-in initiation failed", {
        message: nextError,
      });
    } finally {
      setPendingMagicLink(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    const token = emailOtpCode.trim().replace(/\s+/g, "");
    if (token.length !== expectedEmailOtpLength) {
      setError(`Enter the ${expectedEmailOtpLength}-digit code from your email.`);
      return;
    }

    setPendingEmailOtpVerify(true);
    setError(null);
    setMessage(null);

    try {
      savePendingAuthContext(pendingContext);

      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });

      if (verifyError) {
        throw verifyError;
      }

      const finalizePath = buildFinalizePath({
        nextPath: pendingContext.nextPath,
        linkPlayerId: pendingContext.linkPlayerId,
        expectedLink: pendingContext.expectedLink,
      });

      console.info("[auth/otp] verifyOtp(email) succeeded", {
        nextPath: pendingContext.nextPath,
        hasLinkPlayerId: Boolean(pendingContext.linkPlayerId),
      });
      console.info("[auth/redirect] redirecting after email OTP verify", {
        target: finalizePath,
      });

      router.push(finalizePath);
    } catch (authError) {
      const nextError = authError instanceof Error ? authError.message : "Unable to verify email code";
      setError(nextError);
      console.error("[auth/otp] verifyOtp(email) failed", {
        message: nextError,
      });
    } finally {
      setPendingEmailOtpVerify(false);
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

            <p className="mt-4 text-sm text-slate-600">Email me a sign-in link</p>
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
              {pendingMagicLink ? "Sending..." : "Email me a sign-in link"}
            </button>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Or enter a {expectedEmailOtpLength}-digit code
              </p>
              <input
                id="email-otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={expectedEmailOtpLength}
                value={emailOtpCode}
                onChange={(event) =>
                  setEmailOtpCode(
                    event.target.value.replace(/\s+/g, "").slice(0, expectedEmailOtpLength),
                  )
                }
                placeholder={"0".repeat(expectedEmailOtpLength)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tracking-[0.25em] text-slate-900 outline-none focus:border-slate-400"
              />
              <button
                type="button"
                onClick={handleVerifyEmailOtp}
                disabled={pendingEmailOtpVerify}
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {pendingEmailOtpVerify ? "Verifying..." : "Verify code and continue"}
              </button>
            </div>

            {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}