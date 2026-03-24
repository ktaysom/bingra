"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const CONSENT_TEXT =
  "By continuing, you agree to receive a one-time SMS code from Bingra for login. Message & data rates may apply.";

type PhoneAuthFormProps = {
  nextPath: string;
  linkPlayerId?: string;
  onUseEmailInstead?: () => void;
};

type PhoneStep = "enter_phone" | "enter_code";

function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured;
  }

  return window.location.origin;
}

function buildFinalizeUrl(nextPath: string, linkPlayerId?: string): string {
  const finalizeUrl = new URL("/auth/finalize", getAppBaseUrl());
  finalizeUrl.searchParams.set("next", nextPath);

  if (linkPlayerId) {
    finalizeUrl.searchParams.set("link_player_id", linkPlayerId);
  }

  return finalizeUrl.toString();
}

function normalizePhoneToE164(input: string): { phone?: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Please enter a phone number" };
  }

  const compact = trimmed.replace(/[\s().-]/g, "");

  if (compact.startsWith("+")) {
    const internationalDigits = compact.slice(1).replace(/\D/g, "");

    if (internationalDigits.length < 8 || internationalDigits.length > 15) {
      return { error: "Enter a valid phone number with country code (example: +1 555 123 4567)" };
    }

    return { phone: `+${internationalDigits}` };
  }

  const digits = compact.replace(/\D/g, "");

  if (digits.length === 10) {
    return { phone: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { phone: `+${digits}` };
  }

  if (digits.startsWith("00") && digits.length > 3) {
    const converted = digits.slice(2);

    if (converted.length >= 8 && converted.length <= 15) {
      return { phone: `+${converted}` };
    }
  }

  return { error: "Enter a valid US phone number, or include country code for non-US numbers" };
}

export function PhoneAuthForm({ nextPath, linkPlayerId, onUseEmailInstead }: PhoneAuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<PhoneStep>("enter_phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const supabase = createSupabaseBrowserClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: normalized.phone,
      });

      if (sendError) {
        throw sendError;
      }

      setNormalizedPhone(normalized.phone);
      setStep("enter_code");
      setStatus("Verification code sent. Enter the 6-digit code to continue.");
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
    if (token.length !== 6) {
      setError("Enter the 6-digit code sent to your phone");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (verifyError) {
        throw verifyError;
      }

      setStatus("Signed in. Redirecting...");
      const finalizeUrl = buildFinalizeUrl(nextPath, linkPlayerId);
      router.push(finalizeUrl);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to verify code");
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
              Enter the 6-digit code
            </label>
            <input
              id="phone-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm tracking-[0.25em] text-slate-900 outline-none focus:border-slate-400"
            />
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
