import type { Metadata } from "next";

// Twilio/A2P proof-of-consent review page only.
// This page intentionally demonstrates consent language/UI and is NOT the live auth flow.
export const metadata: Metadata = {
  title: "Bingra SMS Authentication Consent",
  robots: {
    index: false,
    follow: false,
  },
};

const CONSENT_TEXT =
  "Enter your phone number to receive a one-time login code by SMS from Bingra. By continuing, you agree to receive this one-time authentication message. Message & data rates may apply. No marketing messages will be sent.";

export default function SmsAuthConsentPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/95 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Bingra</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">SMS login consent preview</h1>
        <p className="mt-2 text-sm text-slate-600">
          Compliance preview page showing Bingra&apos;s one-time SMS authentication consent language.
        </p>

        <div className="mt-6 space-y-3">
          <label htmlFor="sms-proof-phone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Phone number
          </label>
          <input
            id="sms-proof-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none"
          />

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
            {CONSENT_TEXT}
          </p>

          {/*
            Twilio/A2P proof-of-consent review only:
            keep this button non-submitting and disabled so production auth behavior is unchanged.
          */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white opacity-50"
          >
            Continue
          </button>
        </div>
      </section>
    </main>
  );
}
