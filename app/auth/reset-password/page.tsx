"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      setHasSession(Boolean(data.session));
      setIsLoadingSession(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      setHasSession(Boolean(session));
      setIsLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setMessage("Password updated. Redirecting...");
      setTimeout(() => {
        router.push("/me");
      }, 700);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Set a new password for your Bingra account.</p>

        {isLoadingSession ? (
          <p className="mt-4 text-sm text-slate-500">Checking your reset session...</p>
        ) : hasSession ? (
          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            />

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isPending ? "Updating..." : "Update password"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            This reset link is invalid or expired. Request a new reset email from the sign-in dialog.
          </p>
        )}

        {message ? <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}

        <p className="mt-4 text-xs text-slate-500">
          Back to <Link href="/" className="underline">home</Link>
        </p>
      </section>
    </main>
  );
}
