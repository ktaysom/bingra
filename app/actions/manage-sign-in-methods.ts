"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { resolveAccountIdForAuthUserId } from "../../lib/auth/resolve-account";
import {
  ensureCredentialNotLinkedToDifferentAccount,
  unlinkAuthMethodFromAccount,
} from "../../lib/auth/account-auth-methods";
import { setAccountLinkIntentCookie } from "../../lib/auth/account-link-intent";

type SignInMethodActionState = {
  success?: boolean;
  error?: string;
};

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const phoneSchema = z.object({
  phone: z.string().min(6, "Enter a valid phone number"),
});

const removeSchema = z.object({
  authUserId: z.string().uuid("Invalid sign-in method id"),
});

function normalizePhone(input: string): string {
  return input.trim().replace(/[\s().-]/g, "");
}

export async function prepareAddEmailSignInMethodAction(input: {
  email: string;
}): Promise<SignInMethodActionState> {
  try {
    const parsed = emailSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { error: "You must be signed in." };
    }

    const { accountId } = await resolveAccountIdForAuthUserId(user.id);

    const credentialCheck = await ensureCredentialNotLinkedToDifferentAccount({
      accountId,
      email: parsed.data.email,
    });

    if (credentialCheck.status === "already_linked_same_account") {
      return { error: "That email is already linked to this account." };
    }

    await setAccountLinkIntentCookie(accountId);

    console.info("[manage-sign-in-methods] prepared add-email intent", {
      accountId,
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to prepare email sign-in method.",
    };
  }
}

export async function prepareAddPhoneSignInMethodAction(input: {
  phone: string;
}): Promise<SignInMethodActionState> {
  try {
    const parsed = phoneSchema.safeParse({ phone: normalizePhone(input.phone) });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid phone" };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { error: "You must be signed in." };
    }

    const { accountId } = await resolveAccountIdForAuthUserId(user.id);

    const credentialCheck = await ensureCredentialNotLinkedToDifferentAccount({
      accountId,
      phone: parsed.data.phone,
    });

    if (credentialCheck.status === "already_linked_same_account") {
      return { error: "That phone number is already linked to this account." };
    }

    await setAccountLinkIntentCookie(accountId);

    console.info("[manage-sign-in-methods] prepared add-phone intent", {
      accountId,
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to prepare phone sign-in method.",
    };
  }
}

export async function removeSignInMethodAction(input: {
  authUserId: string;
}): Promise<SignInMethodActionState> {
  try {
    const parsed = removeSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sign-in method" };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { error: "You must be signed in." };
    }

    const { accountId } = await resolveAccountIdForAuthUserId(user.id);

    await unlinkAuthMethodFromAccount({
      accountId,
      authUserId: parsed.data.authUserId,
    });

    console.info("[manage-sign-in-methods] removed sign-in method", {
      accountId,
      authUserId: parsed.data.authUserId,
    });

    revalidatePath("/me");

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to remove sign-in method.",
    };
  }
}
