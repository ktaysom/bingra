import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  buildAuthConfirmPath,
  buildFinalizePath,
  normalizePendingAuthContext,
  type PendingAuthContext,
  savePendingAuthContext,
} from "./auth-redirect";

export const DEFAULT_EMAIL_OTP_LENGTH = 8;

export function getExpectedEmailOtpLength(): number {
  const configured = Number(process.env.NEXT_PUBLIC_EMAIL_OTP_LENGTH);
  if (Number.isInteger(configured) && configured >= 4 && configured <= 12) {
    return configured;
  }

  return DEFAULT_EMAIL_OTP_LENGTH;
}

export async function sendEmailSignInLink(params: {
  email: string;
  appBaseUrl: string;
  pendingContext: PendingAuthContext;
}) {
  const email = params.email.trim();
  const contextWithEmail = normalizePendingAuthContext(
    {
      ...params.pendingContext,
      email,
    },
    "/me",
  );

  savePendingAuthContext(contextWithEmail);

  const emailRedirectTo = new URL(buildAuthConfirmPath(contextWithEmail), params.appBaseUrl).toString();

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    throw error;
  }

  return {
    contextWithEmail,
  };
}

export async function verifyEmailOtpAndGetFinalizePath(params: {
  email: string;
  token: string;
  pendingContext: PendingAuthContext;
}) {
  const email = params.email.trim();
  const token = params.token.trim().replace(/\s+/g, "");
  const contextWithEmail = normalizePendingAuthContext(
    {
      ...params.pendingContext,
      email,
    },
    "/me",
  );

  savePendingAuthContext(contextWithEmail);

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    throw error;
  }

  return {
    finalizePath: buildFinalizePath({
      nextPath: contextWithEmail.nextPath,
      linkPlayerId: contextWithEmail.linkPlayerId,
      expectedLink: contextWithEmail.expectedLink,
    }),
    contextWithEmail,
  };
}
