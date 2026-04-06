import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  buildFinalizePath,
  normalizePendingAuthContext,
  type PendingAuthContext,
  savePendingAuthContext,
} from "./auth-redirect";

export const DEFAULT_PHONE_OTP_LENGTH = 6;
export const PHONE_RESEND_COOLDOWN_SECONDS = 30;

export function getExpectedPhoneOtpLength(): number {
  // Bingra phone OTP is configured as 6-digit SMS code.
  return DEFAULT_PHONE_OTP_LENGTH;
}

export function normalizePhoneToE164(input: string): { phone?: string; error?: string } {
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

  // US-first behavior: accept domestic 10-digit numbers and 11-digit numbers with leading 1.
  if (digits.length === 10) {
    return { phone: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { phone: `+${digits}` };
  }

  // Support international prefix style like 00XX... for non-US fallback.
  if (digits.startsWith("00") && digits.length > 3) {
    const converted = digits.slice(2);

    if (converted.length >= 8 && converted.length <= 15) {
      return { phone: `+${converted}` };
    }
  }

  return { error: "Enter a valid US phone number, or include country code for non-US numbers" };
}

export async function sendPhoneSignInOtp(params: {
  phone: string;
  pendingContext: PendingAuthContext;
  shouldCreateUser?: boolean;
}) {
  const normalized = normalizePhoneToE164(params.phone);
  if (!normalized.phone) {
    throw new Error(normalized.error ?? "Enter a valid phone number");
  }

  const contextWithPhone = normalizePendingAuthContext(
    {
      ...params.pendingContext,
      phone: normalized.phone,
    },
    "/me",
  );

  savePendingAuthContext(contextWithPhone);

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalized.phone,
    options: {
      shouldCreateUser: params.shouldCreateUser ?? true,
    },
  });

  if (error) {
    throw error;
  }

  return {
    contextWithPhone,
    phone: normalized.phone,
  };
}

export async function verifyPhoneOtpAndGetFinalizePath(params: {
  phone: string;
  token: string;
  pendingContext: PendingAuthContext;
}) {
  const normalized = normalizePhoneToE164(params.phone);
  if (!normalized.phone) {
    throw new Error(normalized.error ?? "Enter a valid phone number");
  }

  const token = params.token.trim().replace(/\D/g, "");
  const contextWithPhone = normalizePendingAuthContext(
    {
      ...params.pendingContext,
      phone: normalized.phone,
    },
    "/me",
  );

  savePendingAuthContext(contextWithPhone);

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: normalized.phone,
    token,
    type: "sms",
  });

  if (error) {
    throw error;
  }

  return {
    finalizePath: buildFinalizePath({
      nextPath: contextWithPhone.nextPath,
      linkPlayerId: contextWithPhone.linkPlayerId,
      expectedLink: contextWithPhone.expectedLink,
    }),
    contextWithPhone,
    phone: normalized.phone,
  };
}