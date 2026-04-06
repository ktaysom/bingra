"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  normalizePendingAuthContext,
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

const CREATE_VERIFY_AT_STORAGE_KEY = "bingra.create-after-login.verify-at.v1";
const CREATE_AUTH_CREATE_TRACE_KEY = "bingra.create-after-login.trace.v1";

function formatClientAuthError(error: unknown): { message: string; code: string | null; status: number | null } {
  const asRecord = typeof error === "object" && error ? (error as Record<string, unknown>) : null;
  const message =
    (asRecord?.message && typeof asRecord.message === "string" ? asRecord.message : null) ||
    (error instanceof Error ? error.message : null) ||
    "Unknown auth error";
  const code = asRecord?.code && typeof asRecord.code === "string" ? asRecord.code : null;
  const status = asRecord?.status && typeof asRecord.status === "number" ? asRecord.status : null;

  return { message, code, status };
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
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("phone");

  const [email, setEmail] = useState("");
  const [pendingEmailCodeSend, setPendingEmailCodeSend] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [pendingEmailOtpVerify, setPendingEmailOtpVerify] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [pendingPhoneCodeSend, setPendingPhoneCodeSend] = useState(false);
  const [pendingPhoneOtpVerify, setPendingPhoneOtpVerify] = useState(false);
  const [phoneResendSecondsLeft, setPhoneResendSecondsLeft] = useState(0);

  const [postVerifyProgress, setPostVerifyProgress] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expectedEmailOtpLength = getExpectedEmailOtpLength();
  const expectedPhoneOtpLength = getExpectedPhoneOtpLength();

  const controlsDisabled =
    pendingEmailCodeSend ||
    pendingEmailOtpVerify ||
    pendingPhoneCodeSend ||
    pendingPhoneOtpVerify ||
    postVerifyProgress;
  const isCreateFlowContext = nextPath === "/create" && !linkPlayerId;
  const isHomepageFlowContext = nextPath === "/" && !linkPlayerId;
  const isAccountPageFlowContext = nextPath === "/me";

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

  const close = () => {
    if (controlsDisabled) {
      return;
    }

    setIsOpen(false);
    setPendingEmailCodeSend(false);
    setPendingEmailOtpVerify(false);
    setPendingPhoneCodeSend(false);
    setPendingPhoneOtpVerify(false);
    setPostVerifyProgress(false);
  };

  const switchAuthMethod = (nextMethod: "email" | "phone") => {
    if (controlsDisabled) {
      return;
    }

    setAuthMethod(nextMethod);
    setMessage(null);
    setError(null);
  };

  const handlePostVerifyRedirect = (params: { finalizePath: string; verifyClickAt: number }) => {
    const { finalizePath, verifyClickAt } = params;
    const verifySuccessAt = Date.now();
    const redirectStartAt = Date.now();
    const traceId =
      typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${verifyClickAt}-${Math.random().toString(16).slice(2)}`;

    setPostVerifyProgress(true);
    setMessage(
      isCreateFlowContext
        ? "Code accepted. Signing you in and creating your Bingra game..."
        : "Code accepted. Signing you in...",
    );

    if (isCreateFlowContext && typeof window !== "undefined") {
      window.sessionStorage.setItem(CREATE_VERIFY_AT_STORAGE_KEY, String(verifySuccessAt));
      window.sessionStorage.setItem(
        CREATE_AUTH_CREATE_TRACE_KEY,
        JSON.stringify({
          traceId,
          verifyClickAt,
          verifySuccessAt,
          redirectStartAt,
        }),
      );
    }

    // Homepage sign-in should complete with a hard navigation so server-rendered
    // user state is immediately reflected and modal state cannot remain stale.
    if ((isHomepageFlowContext || isAccountPageFlowContext) && typeof window !== "undefined") {
      setIsOpen(false);
      window.location.assign(finalizePath);
      return;
    }

    router.push(finalizePath);
  };

  const handleSendEmailCode = async () => {
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setPendingEmailCodeSend(true);
    setError(null);
    setMessage(null);

    try {
      await sendEmailSignInLink({
        email: email.trim(),
        appBaseUrl: getAppBaseUrl(),
        pendingContext,
      });

      setMessage(`Code sent. Check your inbox, then enter the ${expectedEmailOtpLength}-digit code below.`);
    } catch (authError) {
      const details = formatClientAuthError(authError);
      const nextError = details.message || "Unable to send sign-in email";
      setError(nextError);
      console.error("[auth/init] email code sign-in initiation failed", {
        message: nextError,
        code: details.code,
        status: details.status,
      });
    } finally {
      setPendingEmailCodeSend(false);
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
      setPostVerifyProgress(false);
      return;
    }

    setPendingEmailOtpVerify(true);
    setPostVerifyProgress(false);
    setError(null);
    setMessage(null);

    const verifyClickAt = Date.now();

    try {
      const { finalizePath } = await verifyEmailOtpAndGetFinalizePath({
        email: email.trim(),
        token,
        pendingContext,
      });
      handlePostVerifyRedirect({ finalizePath, verifyClickAt });
    } catch (authError) {
      setPostVerifyProgress(false);
      const details = formatClientAuthError(authError);
      const nextError = details.message || "Unable to verify email code";
      setError(nextError);
      console.error("[auth/otp] verifyOtp(email) failed", {
        message: nextError,
        code: details.code,
        status: details.status,
      });
      setPendingEmailOtpVerify(false);
    } finally {
      // Keep pending state through redirect once verify succeeds; reset on error path above.
    }
  };

  const handleSendPhoneCode = async () => {
    const normalized = normalizePhoneToE164(phoneNumber);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    setPendingPhoneCodeSend(true);
    setError(null);
    setMessage(null);

    try {
      const { phone } = await sendPhoneSignInOtp({
        phone: normalized.phone,
        pendingContext,
        shouldCreateUser: true,
      });

      setNormalizedPhone(phone);
      setPhoneResendSecondsLeft(PHONE_RESEND_COOLDOWN_SECONDS);
      setMessage(`Code sent. Enter the ${expectedPhoneOtpLength}-digit code from your SMS.`);
    } catch (authError) {
      const details = formatClientAuthError(authError);
      const nextError = details.message || "Unable to send SMS code";
      setError(nextError);
      console.error("[auth/init] phone OTP initiation failed", {
        message: nextError,
        code: details.code,
        status: details.status,
      });
    } finally {
      setPendingPhoneCodeSend(false);
    }
  };

  const handleResendPhoneCode = async () => {
    if (phoneResendSecondsLeft > 0) {
      return;
    }

    const sourcePhone = normalizedPhone ?? phoneNumber;
    const normalized = normalizePhoneToE164(sourcePhone);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    setPendingPhoneCodeSend(true);
    setError(null);
    setMessage(null);

    try {
      const { phone } = await sendPhoneSignInOtp({
        phone: normalized.phone,
        pendingContext,
        shouldCreateUser: true,
      });

      setNormalizedPhone(phone);
      setPhoneResendSecondsLeft(PHONE_RESEND_COOLDOWN_SECONDS);
      setMessage(`New code sent. Enter the ${expectedPhoneOtpLength}-digit code from your SMS.`);
    } catch (authError) {
      const details = formatClientAuthError(authError);
      const nextError = details.message || "Unable to resend SMS code";
      setError(nextError);
      console.error("[auth/init] phone OTP resend failed", {
        message: nextError,
        code: details.code,
        status: details.status,
      });
    } finally {
      setPendingPhoneCodeSend(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const sourcePhone = normalizedPhone ?? phoneNumber;
    const normalized = normalizePhoneToE164(sourcePhone);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    const token = phoneOtpCode.trim().replace(/\D/g, "");
    if (token.length !== expectedPhoneOtpLength) {
      setError(`Enter the ${expectedPhoneOtpLength}-digit code from your SMS.`);
      setPostVerifyProgress(false);
      return;
    }

    setPendingPhoneOtpVerify(true);
    setPostVerifyProgress(false);
    setError(null);
    setMessage(null);

    const verifyClickAt = Date.now();

    try {
      const { finalizePath, phone } = await verifyPhoneOtpAndGetFinalizePath({
        phone: normalized.phone,
        token,
        pendingContext,
      });

      setNormalizedPhone(phone);
      handlePostVerifyRedirect({ finalizePath, verifyClickAt });
    } catch (authError) {
      setPostVerifyProgress(false);
      const details = formatClientAuthError(authError);
      const nextError = details.message || "Unable to verify SMS code";
      setError(nextError);
      console.error("[auth/otp] verifyOtp(phone) failed", {
        message: nextError,
        code: details.code,
        status: details.status,
      });
      setPendingPhoneOtpVerify(false);
    } finally {
      // Keep pending state through redirect once verify succeeds; reset on error path above.
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

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => switchAuthMethod("email")}
                disabled={controlsDisabled}
                className={`inline-flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition ${
                  authMethod === "email"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white/80 disabled:opacity-60"
                }`}
              >
                Continue with email
              </button>
              <button
                type="button"
                onClick={() => switchAuthMethod("phone")}
                disabled={controlsDisabled}
                className={`inline-flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition ${
                  authMethod === "phone"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white/80 disabled:opacity-60"
                }`}
              >
                Continue with phone
              </button>
            </div>

            {authMethod === "email" ? (
              <>
                <p className="mt-4 text-sm text-slate-600">Step 1: Enter your email to get a sign-in code</p>
                <input
                  id="magic-link-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={controlsDisabled}
                  placeholder="you@example.com"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={handleSendEmailCode}
                  disabled={controlsDisabled}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {pendingEmailCodeSend ? "Sending..." : "Send sign-in code"}
                </button>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Step 2: Enter your {expectedEmailOtpLength}-digit code
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
                    disabled={controlsDisabled}
                    placeholder={"0".repeat(expectedEmailOtpLength)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tracking-[0.25em] text-slate-900 outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={controlsDisabled}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {postVerifyProgress
                      ? "Continuing..."
                      : pendingEmailOtpVerify
                        ? "Verifying..."
                        : "Verify code and continue"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-600">Step 1: Enter your phone to get an SMS code</p>
                <input
                  id="phone-otp-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  disabled={controlsDisabled}
                  placeholder="+1 555 123 4567"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  US numbers can be entered as 10 digits. Non-US numbers should include country code.
                </p>
                <button
                  type="button"
                  onClick={handleSendPhoneCode}
                  disabled={controlsDisabled}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {pendingPhoneCodeSend ? "Sending..." : "Send SMS code"}
                </button>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Step 2: Enter your {expectedPhoneOtpLength}-digit SMS code
                  </p>
                  <input
                    id="phone-otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={expectedPhoneOtpLength}
                    value={phoneOtpCode}
                    onChange={(event) =>
                      setPhoneOtpCode(
                        event.target.value.replace(/\D/g, "").slice(0, expectedPhoneOtpLength),
                      )
                    }
                    disabled={controlsDisabled}
                    placeholder={"0".repeat(expectedPhoneOtpLength)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tracking-[0.25em] text-slate-900 outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    disabled={controlsDisabled}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {postVerifyProgress
                      ? "Continuing..."
                      : pendingPhoneOtpVerify
                        ? "Verifying..."
                        : "Verify code and continue"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendPhoneCode}
                    disabled={controlsDisabled || phoneResendSecondsLeft > 0}
                    className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl text-xs font-semibold text-slate-600 underline disabled:opacity-60"
                  >
                    {pendingPhoneCodeSend
                      ? "Sending..."
                      : phoneResendSecondsLeft > 0
                        ? `Resend code in ${phoneResendSecondsLeft}s`
                        : `Resend ${normalizedPhone ? `to ${normalizedPhone}` : "code"}`}
                  </button>
                </div>
              </>
            )}

            {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}