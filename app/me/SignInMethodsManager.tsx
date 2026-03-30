"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { buildAuthConfirmPath, normalizePendingAuthContext, savePendingAuthContext } from "../../lib/auth/auth-redirect";
import {
  prepareAddEmailSignInMethodAction,
  prepareAddPhoneSignInMethodAction,
  removeSignInMethodAction,
} from "../actions/manage-sign-in-methods";

type SignInMethod = {
  auth_user_id: string;
  email: string | null;
  phone: string | null;
  linked_at: string | null;
  is_primary: boolean;
};

type Props = {
  methods: SignInMethod[];
};

type PhoneStep = "enter_phone" | "enter_code";

function normalizePhoneToE164(input: string): { phone?: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Please enter a phone number" };
  }

  const compact = trimmed.replace(/[\s().-]/g, "");

  if (compact.startsWith("+")) {
    const internationalDigits = compact.slice(1).replace(/\D/g, "");

    if (internationalDigits.length < 8 || internationalDigits.length > 15) {
      return { error: "Enter a valid phone number with country code" };
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

  return { error: "Enter a valid phone number" };
}

function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured;
  }

  return window.location.origin;
}

export function SignInMethodsManager({ methods }: Props) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter_phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const methodCount = useMemo(
    () => methods.filter((method) => Boolean(method.email || method.phone)).length,
    [methods],
  );

  const handleAddEmail = async () => {
    setError(null);
    setStatus(null);

    if (!emailInput.trim()) {
      setError("Enter an email address.");
      return;
    }

    setIsLoading(true);
    try {
      const prep = await prepareAddEmailSignInMethodAction({ email: emailInput.trim() });
      if (prep.error) {
        setError(prep.error);
        return;
      }

      const pendingContext = normalizePendingAuthContext({
        nextPath: "/me",
        expectedLink: true,
        intent: "account_link",
      });
      savePendingAuthContext(pendingContext);

      const emailRedirectTo = new URL(buildAuthConfirmPath(pendingContext), getAppBaseUrl()).toString();
      console.info("[auth/init] starting account-link email sign-in", {
        nextPath: pendingContext.nextPath,
        expectedLink: pendingContext.expectedLink,
      });

      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (authError) {
        throw authError;
      }

      setStatus("Magic link sent. Open your email to finish linking this sign-in method.");
      console.info("[auth/init] account-link email sign-in sent");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to add email sign-in.";
      setError(message);
      console.error("[auth/init] account-link email sign-in failed", {
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    setError(null);
    setStatus(null);

    const normalized = normalizePhoneToE164(phoneInput);
    if (!normalized.phone) {
      setError(normalized.error ?? "Enter a valid phone number.");
      return;
    }

    setIsLoading(true);
    try {
      const prep = await prepareAddPhoneSignInMethodAction({ phone: normalized.phone });
      if (prep.error) {
        setError(prep.error);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: normalized.phone,
      });

      if (sendError) {
        throw sendError;
      }

      setNormalizedPhone(normalized.phone);
      setPhoneStep("enter_code");
      setStatus("Verification code sent. Enter the code to finish linking this sign-in method.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send phone verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    const phone = normalizedPhone ?? normalizePhoneToE164(phoneInput).phone;
    if (!phone) {
      setError("Please enter a valid phone number");
      setPhoneStep("enter_phone");
      return;
    }

    const token = phoneCode.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setIsLoading(true);
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

      router.push("/auth/finalize?next=/me&expected_link=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to verify phone code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMethod = async (authUserId: string) => {
    setIsLoading(true);
    setError(null);
    setStatus(null);
    try {
      const result = await removeSignInMethodAction({ authUserId });
      if (result.error) {
        setError(result.error);
        return;
      }

      setStatus("Sign-in method removed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove sign-in method.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Sign-in methods</h2>
      <p className="mt-1 text-xs text-slate-600">
        Email and phone are private credentials used for login. Your public identity remains your username.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Adding a method links it to this same Bingra account. Removing detaches it from this account only and does not
        delete the underlying auth credential.
      </p>

      <ul className="mt-3 space-y-2">
        {methods.length === 0 ? (
          <li className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
            No linked sign-in methods found yet.
          </li>
        ) : (
          methods.map((method) => {
            const label = method.email || method.phone || method.auth_user_id;
            return (
              <li
                key={method.auth_user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0 text-sm text-slate-800">
                  <p className="truncate font-medium">{label}</p>
                  <p className="text-xs text-slate-500">{method.email ? "Email" : method.phone ? "Phone" : "Auth"}</p>
                </div>
                <button
                  type="button"
                  disabled={isLoading || methodCount <= 1}
                  onClick={() => handleRemoveMethod(method.auth_user_id)}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })
        )}
      </ul>
      {methodCount <= 1 ? (
        <p className="mt-2 text-xs text-slate-500">At least one sign-in method must remain linked.</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add email</h3>
          <input
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAddEmail}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            Send magic link
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add phone</h3>
          <input
            type="tel"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            placeholder="+1 555 123 4567"
            disabled={isLoading || phoneStep === "enter_code"}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />

          {phoneStep === "enter_code" ? (
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={phoneCode}
              onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm tracking-[0.2em] text-slate-900 outline-none focus:border-slate-400"
            />
          ) : null}

          <button
            type="button"
            disabled={isLoading}
            onClick={phoneStep === "enter_code" ? handleVerifyPhone : handleSendPhoneCode}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {phoneStep === "enter_code" ? "Verify and link phone" : "Send code"}
          </button>
        </div>
      </div>

      {status ? <p className="mt-3 text-xs font-medium text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
