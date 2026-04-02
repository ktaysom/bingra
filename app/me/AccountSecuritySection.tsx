"use client";

import { FormEvent, useMemo, useState } from "react";
import { updateAuthenticatedUserPassword } from "../../lib/auth/password-auth-client";

const MIN_PASSWORD_LENGTH = 8;
const ENABLE_PASSWORD_AUTH = process.env.NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === "1";

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasLetter || !hasNumber) {
    return "Password must include at least one letter and one number.";
  }

  return null;
}

export function AccountSecuritySection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const passwordValidationError = useMemo(() => validatePassword(newPassword), [newPassword]);

  if (!ENABLE_PASSWORD_AUTH) {
    return null;
  }

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setError(null);
    setStatus(null);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setError(null);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError(null);
    setStatus(null);

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateAuthenticatedUserPassword({ password: newPassword });
      setStatus("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Account security</h2>
      <p className="mt-1 text-xs text-slate-600">Password login is optional for your account.</p>
      <p className="mt-1 text-xs text-slate-500">You can always continue signing in with an email code.</p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => handleNewPasswordChange(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            At least {MIN_PASSWORD_LENGTH} characters, including a letter and a number.
          </p>
          {newPassword && passwordValidationError ? (
            <p className="mt-1 text-xs font-medium text-red-600">{passwordValidationError}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => handleConfirmPasswordChange(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Update password"}
        </button>
      </form>

      {status ? <p className="mt-3 text-xs font-medium text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
