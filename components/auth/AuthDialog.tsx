"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type AuthDialogProps = {
  label?: string;
  nextPath: string;
  linkPlayerId?: string;
  emphasis?: "subtle" | "prominent";
};

type PasswordMode = "sign_in" | "sign_up";

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

function buildAuthFinalizeUrl(nextPath: string, linkPlayerId?: string): string {
  const finalizeUrl = new URL("/auth/finalize", getAppBaseUrl());
  finalizeUrl.searchParams.set("next", nextPath);

  if (linkPlayerId) {
    finalizeUrl.searchParams.set("link_player_id", linkPlayerId);
  }

  return finalizeUrl.toString();
}

export function AuthDialog({
  label = "Sign in",
  nextPath,
  linkPlayerId,
  emphasis = "subtle",
}: AuthDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("sign_in");
  const [pendingGoogle, setPendingGoogle] = useState(false);
  const [pendingMagicLink, setPendingMagicLink] = useState(false);
  const [pendingPasswordAuth, setPendingPasswordAuth] = useState(false);
  const [pendingResetEmail, setPendingResetEmail] = useState(false);
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
    setPendingGoogle(false);
    setPendingMagicLink(false);
    setPendingPasswordAuth(false);
    setPendingResetEmail(false);
  };

  const handleGoogle = async () => {
    setPendingGoogle(true);
    setError(null);

    try {
      const redirectTo = buildAuthCallbackUrl(nextPath, linkPlayerId);
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (signInError) {
        throw signInError;
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to start Google sign in";
      setError(message);
      setPendingGoogle(false);
    }
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

      setMessage("Magic link sent. Check your inbox to continue.");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to send magic link";
      setError(message);
    } finally {
      setPendingMagicLink(false);
    }
  };

  const handlePasswordAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setPendingPasswordAuth(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (passwordMode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        window.location.assign(buildAuthFinalizeUrl(nextPath, linkPlayerId));
        return;
      }

      const emailRedirectTo = buildAuthCallbackUrl(nextPath, linkPlayerId);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        window.location.assign(buildAuthFinalizeUrl(nextPath, linkPlayerId));
        return;
      }

      setMessage("Account created. Check your email to verify your account and finish sign in.");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to continue with password";
      setError(message);
    } finally {
      setPendingPasswordAuth(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first so we can send a reset link");
      return;
    }

    setPendingResetEmail(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = buildAuthCallbackUrl("/auth/reset-password");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      setMessage("Password reset email sent. Use the link in your inbox to set a new password.");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to send reset email";
      setError(message);
    } finally {
      setPendingResetEmail(false);
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

            <button
              type="button"
              onClick={handleGoogle}
              disabled={pendingGoogle || pendingMagicLink || pendingPasswordAuth || pendingResetEmail}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {pendingGoogle ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="my-4 h-px bg-slate-200" />

            <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="magic-link-email">
              Email magic link
            </label>
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
              disabled={pendingGoogle || pendingMagicLink || pendingPasswordAuth || pendingResetEmail}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pendingMagicLink ? "Sending..." : "Send magic link"}
            </button>

            <div className="my-4 h-px bg-slate-200" />

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email + password</p>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPasswordMode("sign_in")}
                  className={`rounded-md px-2 py-1 ${
                    passwordMode === "sign_in" ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordMode("sign_up")}
                  className={`rounded-md px-2 py-1 ${
                    passwordMode === "sign_up" ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  Create account
                </button>
              </div>
            </div>

            <form className="mt-3 space-y-3" onSubmit={handlePasswordAuth}>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />

              <button
                type="submit"
                disabled={pendingGoogle || pendingMagicLink || pendingPasswordAuth || pendingResetEmail}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {pendingPasswordAuth
                  ? "Working..."
                  : passwordMode === "sign_in"
                    ? "Sign in with password"
                    : "Create account"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={pendingGoogle || pendingMagicLink || pendingPasswordAuth || pendingResetEmail}
              className="mt-2 text-xs font-semibold text-slate-600 underline disabled:opacity-60"
            >
              {pendingResetEmail ? "Sending reset email..." : "Forgot password?"}
            </button>

            <p className="mt-3 text-xs text-slate-500">
              Prefer phone verification?{" "}
              <Link href="/auth/phone" className="font-semibold text-slate-700 underline">
                Use phone sign in
              </Link>
            </p>

            {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}