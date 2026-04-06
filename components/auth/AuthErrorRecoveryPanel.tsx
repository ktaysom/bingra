"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  mergePendingAuthContexts,
  normalizePendingAuthContext,
  readPendingAuthContextFromStorage,
  type PendingAuthContext,
} from "../../lib/auth/auth-redirect";
import {
  getExpectedEmailOtpLength,
  sendEmailSignInLink,
  verifyEmailOtpAndGetFinalizePath,
} from "../../lib/auth/email-auth-client";
import {
  getExpectedPhoneOtpLength,
  normalizePhoneToE164,
  PHONE_RESEND_COOLDOWN_SECONDS,
  sendPhoneSignInOtp,
  verifyPhoneOtpAndGetFinalizePath,
} from "../../lib/auth/phone-auth-client";

function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured;
  }

  return window.location.origin;
}

type AuthErrorRecoveryPanelProps = {
  authError: string;
  initialContext?: Partial<PendingAuthContext>;
};

export function AuthErrorRecoveryPanel({ authError, initialContext }: AuthErrorRecoveryPanelProps) {
  const router = useRouter();
  const expectedEmailOtpLength = getExpectedEmailOtpLength();
  const expectedPhoneOtpLength = getExpectedPhoneOtpLength();

  const pendingContext = useMemo(() => {
    const fromStorage = readPendingAuthContextFromStorage();
    const fromProps = normalizePendingAuthContext(initialContext, "/me");
    return mergePendingAuthContexts(fromProps, fromStorage);
  }, [initialContext]);

  const [authMethod, setAuthMethod] = useState<"email" | "phone">("phone");
  const [email, setEmail] = useState(pendingContext.email ?? "");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [phoneInput, setPhoneInput] = useState(pendingContext.phone ?? "");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(pendingContext.phone ?? null);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneResendSecondsLeft, setPhoneResendSecondsLeft] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const hasKnownEmail = Boolean(pendingContext.email?.trim());

  useEffect(() => {
    if (!phoneResendSecondsLeft) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPhoneResendSecondsLeft((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phoneResendSecondsLeft]);

  const handleVerifyEmailOtp = async () => {
    if (!email.trim()) {
      setError("Enter your email address to verify your code.");
      return;
    }

    const token = emailOtpCode.trim().replace(/\s+/g, "");
    if (token.length !== expectedEmailOtpLength) {
      setError(`Enter the ${expectedEmailOtpLength}-digit code from your email.`);
      return;
    }

    setIsVerifying(true);
    setStatus(null);
    setError(null);

    try {
      const { finalizePath } = await verifyEmailOtpAndGetFinalizePath({
        email: email.trim(),
        token,
        pendingContext,
      });

      console.info("[auth][recovery] verifyOtp succeeded", {
        hasPendingContext: Boolean(pendingContext),
        finalizePath,
      });

      setStatus("Code verified. Finishing sign-in...");
      router.push(finalizePath);
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : "Unable to verify code";
      console.error("[auth][recovery] verifyOtp failed", {
        message,
      });
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (!email.trim()) {
      setError("Enter your email address to send a new sign-in email.");
      return;
    }

    setIsResending(true);
    setStatus(null);
    setError(null);

    try {
      await sendEmailSignInLink({
        email: email.trim(),
        appBaseUrl: getAppBaseUrl(),
        pendingContext,
      });

      console.info("[auth][recovery] resend sign-in link succeeded", {
        email: email.trim(),
      });

      setStatus(`New sign-in code sent. Enter the ${expectedEmailOtpLength}-digit code from your email.`);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Unable to send sign-in email";
      console.error("[auth][recovery] resend sign-in link failed", {
        message,
      });
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleSendPhoneCode = async () => {
    const normalized = normalizePhoneToE164(phoneInput);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    setIsResending(true);
    setStatus(null);
    setError(null);

    try {
      const { phone } = await sendPhoneSignInOtp({
        phone: normalized.phone,
        pendingContext,
        shouldCreateUser: true,
      });

      setNormalizedPhone(phone);
      setPhoneResendSecondsLeft(PHONE_RESEND_COOLDOWN_SECONDS);
      setStatus(`SMS code sent. Enter the ${expectedPhoneOtpLength}-digit code from your phone.`);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Unable to send SMS code";
      console.error("[auth][recovery] resend SMS code failed", {
        message,
      });
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const sourcePhone = normalizedPhone ?? phoneInput;
    const normalized = normalizePhoneToE164(sourcePhone);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    const token = phoneOtpCode.trim().replace(/\D/g, "");
    if (token.length !== expectedPhoneOtpLength) {
      setError(`Enter the ${expectedPhoneOtpLength}-digit code from your SMS.`);
      return;
    }

    setIsVerifying(true);
    setStatus(null);
    setError(null);

    try {
      const { finalizePath, phone } = await verifyPhoneOtpAndGetFinalizePath({
        phone: normalized.phone,
        token,
        pendingContext,
      });

      setNormalizedPhone(phone);
      console.info("[auth][recovery] verifyOtp(phone) succeeded", {
        hasPendingContext: Boolean(pendingContext),
        finalizePath,
      });

      setStatus("Code verified. Finishing sign-in...");
      router.push(finalizePath);
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : "Unable to verify SMS code";
      console.error("[auth][recovery] verifyOtp(phone) failed", {
        message,
      });
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Sign-in recovery</p>
      <h2 className="mt-1 text-base font-semibold text-slate-900">Sign-in needs code verification.</h2>
      <p className="mt-1 text-sm text-slate-700">You can still finish signing in with your email or phone code.</p>

      <p className="mt-2 text-xs text-slate-600">{authError}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-amber-200 bg-white p-1">
        <button
          type="button"
          onClick={() => {
            setAuthMethod("email");
            setStatus(null);
            setError(null);
          }}
          disabled={isVerifying || isResending}
          className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-semibold transition ${
            authMethod === "email"
              ? "bg-amber-50 text-amber-900"
              : "text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          }`}
        >
          Continue with email
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod("phone");
            setStatus(null);
            setError(null);
          }}
          disabled={isVerifying || isResending}
          className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-semibold transition ${
            authMethod === "phone"
              ? "bg-amber-50 text-amber-900"
              : "text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          }`}
        >
          Continue with phone
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {authMethod === "email" ? (
          <>
            {!hasKnownEmail ? (
              <div>
                <label htmlFor="auth-recovery-email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  id="auth-recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-700">
                Sending/Verifying for <span className="font-semibold">{pendingContext.email}</span>
              </p>
            )}

            <div>
              <label htmlFor="auth-recovery-email-otp" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {expectedEmailOtpLength}-digit code
              </label>
              <input
                id="auth-recovery-email-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={expectedEmailOtpLength}
                value={emailOtpCode}
                onChange={(event) => setEmailOtpCode(event.target.value.replace(/\s+/g, "").slice(0, expectedEmailOtpLength))}
                placeholder={"0".repeat(expectedEmailOtpLength)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm tracking-[0.2em] text-slate-900 outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleVerifyEmailOtp}
                disabled={isVerifying || isResending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isVerifying ? "Verifying..." : "Verify code and continue"}
              </button>
              <button
                type="button"
                onClick={handleResendEmailCode}
                disabled={isResending || isVerifying}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isResending ? "Sending..." : "Send a new code"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="auth-recovery-phone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone number
              </label>
              <input
                id="auth-recovery-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="+1 555 123 4567"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label htmlFor="auth-recovery-phone-otp" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {expectedPhoneOtpLength}-digit SMS code
              </label>
              <input
                id="auth-recovery-phone-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={expectedPhoneOtpLength}
                value={phoneOtpCode}
                onChange={(event) => setPhoneOtpCode(event.target.value.replace(/\D/g, "").slice(0, expectedPhoneOtpLength))}
                placeholder={"0".repeat(expectedPhoneOtpLength)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm tracking-[0.2em] text-slate-900 outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleVerifyPhoneOtp}
                disabled={isVerifying || isResending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isVerifying ? "Verifying..." : "Verify code and continue"}
              </button>
              <button
                type="button"
                onClick={handleSendPhoneCode}
                disabled={isResending || isVerifying || phoneResendSecondsLeft > 0}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isResending
                  ? "Sending..."
                  : phoneResendSecondsLeft > 0
                    ? `Resend in ${phoneResendSecondsLeft}s`
                    : `Send ${normalizedPhone ? `to ${normalizedPhone}` : "SMS code"}`}
              </button>
            </div>
          </>
        )}
      </div>

      {status ? <p className="mt-3 text-xs font-medium text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
