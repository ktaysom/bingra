"use client";

import Link from "next/link";
import { useState } from "react";

const CONSENT_TEXT =
  "By continuing, you agree to receive a one-time SMS from Bingra to verify your identity. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help.";

const CONSENT_TEXT_VERSION = "bingra_sms_consent_v1_2026_03_21";

function logPhoneConsentEvent(phone: string) {
  const event = {
    phone,
    timestamp: new Date().toISOString(),
    page: "/auth/phone",
    consentTextVersion: CONSENT_TEXT_VERSION,
  };

  // TODO(phase-3-phone-auth): persist consent events in a dedicated database table
  // (e.g. auth_phone_consents) before sending OTP for legal/compliance auditing.
  console.info("[phone-auth-consent]", event);
}

export function PhoneAuthForm() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPhone = phone.trim();

    if (!trimmedPhone) {
      setError("Please enter a phone number");
      return;
    }

    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      logPhoneConsentEvent(trimmedPhone);

      // TODO(phase-3-phone-auth): call supabase.auth.signInWithOtp({ phone: trimmedPhone, ... })
      // after consent event persistence is live.
      setMessage("Phone sign-in will be enabled soon. Consent has been captured for this session.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to continue");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
      </div>

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
        {CONSENT_TEXT}
      </p>

      <p className="text-xs text-slate-500">
        By proceeding you agree to our <Link href="/legal/terms" className="underline">Terms of Service</Link>{" "}
        and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "Continuing..." : "Continue"}
      </button>

      {message ? <p className="text-xs font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </form>
  );
}
