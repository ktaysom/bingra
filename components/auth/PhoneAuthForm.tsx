"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizePendingAuthContext } from "../../lib/auth/auth-redirect";
import {
  getExpectedPhoneOtpLength,
  normalizePhoneToE164,
  PHONE_RESEND_COOLDOWN_SECONDS,
  sendPhoneSignInOtp,
  verifyPhoneOtpAndGetFinalizePath,
} from "../../lib/auth/phone-auth-client";

const CONSENT_TEXT =
  "By continuing, you agree to receive a one-time SMS code from Bingra for login. Message & data rates may apply.";

type PhoneAuthFormProps = {
  nextPath: string;
  linkPlayerId?: string;
  onUseEmailInstead?: () => void;
};

type PhoneStep = "enter_phone" | "enter_code";

export function PhoneAuthForm({ nextPath, linkPlayerId, onUseEmailInstead }: PhoneAuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<PhoneStep>("enter_phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const expectedOtpLength = getExpectedPhoneOtpLength();

  const pendingContext = normalizePendingAuthContext({
    nextPath,
    linkPlayerId,
    playerId: linkPlayerId,
    intent: linkPlayerId ? "save_stats" : "sign_in",
  });

  useEffect(() => {
    if (!resendSecondsLeft) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setResendSecondsLeft((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [resendSecondsLeft]);

  const handleSendCode = async () => {
    const normalized = normalizePhoneToE164(phoneNumber);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const { phone } = await sendPhoneSignInOtp({
        phone: normalized.phone,
        pendingContext,
        shouldCreateUser: true,
      });

      setNormalizedPhone(phone);
      setStep("enter_code");
      setResendSecondsLeft(PHONE_RESEND_COOLDOWN_SECONDS);
      setStatus(`Verification code sent. Enter the ${expectedOtpLength}-digit code to continue.`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to send verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    const phone = normalizedPhone ?? normalizePhoneToE164(phoneNumber).phone;

    if (!phone) {
      setError("Please enter a valid phone number");
      setStep("enter_phone");
      return;
    }

    const token = code.replace(/\D/g, "");
    if (token.length !== expectedOtpLength) {
      setError(`Enter the ${expectedOtpLength}-digit code sent to your phone`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const { finalizePath, phone: verifiedPhone } = await verifyPhoneOtpAndGetFinalizePath({
        phone,
        token,
        pendingContext,
      });

      setNormalizedPhone(verifiedPhone);
      setStatus("Signed in. Redirecting...");
      router.push(finalizePath);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to verify code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendSecondsLeft > 0) {
      return;
    }

    const sourcePhone = normalizedPhone ?? phoneNumber;
    const normalized = normalizePhoneToE164(sourcePhone);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number");
      setStep("enter_phone");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const { phone } = await sendPhoneSignInOtp({
        phone: normalized.phone,
        pendingContext,
        shouldCreateUser: true,
      });

      setNormalizedPhone(phone);
      setResendSecondsLeft(PHONE_RESEND_COOLDOWN_SECONDS);
      setStatus(`New ${expectedOtpLength}-digit code sent.`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to resend verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPhone = () => {
    setStep("enter_phone");
    setCode("");
    setError(null);
    setStatus(null);
  };

  const isCodeStep = step === "enter_code";

  return (
    <div className="mt-6 space-y-4">
      <div>
        <label htmlFor="phone-number" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Phone number
        </label>
        <input
          id="phone-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          disabled={isSubmitting || isCodeStep}
          className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </div>

      {isCodeStep ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span>Code sent to {normalizedPhone ?? phoneNumber}</span>
            <button
              type="button"
              onClick={handleEditPhone}
              disabled={isSubmitting}
              className="font-semibold text-slate-700 underline disabled:opacity-60"
            >
              Edit
            </button>
          </div>

          <div>
            <label htmlFor="phone-code" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Enter the {expectedOtpLength}-digit code
            </label>
            <input
              id="phone-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={expectedOtpLength}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, expectedOtpLength))}
              placeholder={"0".repeat(expectedOtpLength)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm tracking-[0.25em] text-slate-900 outline-none focus:border-slate-400"
            />
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isSubmitting || resendSecondsLeft > 0}
              className="mt-2 inline-flex h-8 items-center justify-center text-xs font-semibold text-slate-600 underline disabled:opacity-60"
            >
              {resendSecondsLeft > 0 ? `Resend code in ${resendSecondsLeft}s` : "Resend code"}
            </button>
          </div>
        </>
      ) : null}

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
        {CONSENT_TEXT}
      </p>

      <p className="text-xs text-slate-500">
        By proceeding you agree to our <Link href="/legal/terms" className="underline">Terms of Service</Link>{" "}
        and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <button
        type="button"
        onClick={isCodeStep ? handleVerifyCode : handleSendCode}
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {isSubmitting
          ? isCodeStep
            ? "Verifying..."
            : "Sending..."
          : isCodeStep
            ? "Verify code"
            : "Send verification code"}
      </button>

      {onUseEmailInstead ? (
        <button
          type="button"
          onClick={onUseEmailInstead}
          className="w-full text-center text-xs font-semibold text-slate-600 underline"
        >
          Use email instead
        </button>
      ) : null}

      {status ? <p className="text-xs font-medium text-emerald-700">{status}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
