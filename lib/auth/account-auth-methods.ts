import { createSupabaseAdminClient } from "../supabase/admin";

export type AccountAuthMethod = {
  auth_user_id: string;
  email: string | null;
  phone: string | null;
  linked_at: string | null;
  is_primary: boolean;
};

type CredentialConflictCheck = {
  status: "ok" | "already_linked_same_account";
};

export async function listAccountAuthMethods(accountId: string): Promise<AccountAuthMethod[]> {
  const supabase = createSupabaseAdminClient();

  const { data: links, error: linksError } = await supabase
    .from("account_auth_links")
    .select("auth_user_id, linked_at, is_primary")
    .eq("account_id", accountId)
    .order("linked_at", { ascending: true });

  if (linksError) {
    throw linksError;
  }

  const normalizedLinks =
    (links as Array<{ auth_user_id: string; linked_at?: string | null; is_primary?: boolean | null }> | null) ?? [];

  if (!normalizedLinks.length) {
    return [];
  }

  const methods: AccountAuthMethod[] = [];

  for (const link of normalizedLinks) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(link.auth_user_id);
    if (userError) {
      throw userError;
    }

    methods.push({
      auth_user_id: link.auth_user_id,
      email: userData.user?.email ?? null,
      phone: userData.user?.phone ?? null,
      linked_at: link.linked_at ?? null,
      is_primary: Boolean(link.is_primary),
    });
  }

  return methods;
}

export async function resolvePrimaryAuthMethod(authUserId: string): Promise<{ email: string | null; phone: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(authUserId);

  if (error) {
    throw error;
  }

  return {
    email: data.user?.email ?? null,
    phone: data.user?.phone ?? null,
  };
}

export async function unlinkAuthMethodFromAccount(params: {
  accountId: string;
  authUserId: string;
}): Promise<{ removed: boolean }> {
  const supabase = createSupabaseAdminClient();

  const methods = await listAccountAuthMethods(params.accountId);

  const exists = methods.some((method) => method.auth_user_id === params.authUserId);
  if (!exists) {
    return { removed: false };
  }

  const { data, error } = await supabase.rpc("unlink_account_auth_method", {
    p_account_id: params.accountId,
    p_auth_user_id: params.authUserId,
  });

  if (error) {
    throw error;
  }

  const removed = Boolean((data as { removed?: boolean } | null)?.removed);

  console.info("[unlinkAuthMethodFromAccount] unlink attempt", {
    accountId: params.accountId,
    authUserId: params.authUserId,
    removed,
  });

  return { removed };
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function normalizePhone(input: string): string {
  return input.trim().replace(/[\s().-]/g, "");
}

export async function ensureCredentialNotLinkedToDifferentAccount(params: {
  accountId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<CredentialConflictCheck> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = params.email ? normalizeEmail(params.email) : null;
  const normalizedPhone = params.phone ? normalizePhone(params.phone) : null;

  if (!normalizedEmail && !normalizedPhone) {
    return { status: "ok" };
  }

  const collectedUsers: Array<{ id: string; email?: string | null; phone?: string | null }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    collectedUsers.push(...users.map((u) => ({ id: u.id, email: u.email, phone: u.phone })));

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  const matchedUsers = collectedUsers.filter((user) => {
    const userEmail = user.email ? normalizeEmail(user.email) : null;
    const userPhone = user.phone ? normalizePhone(user.phone) : null;

    if (normalizedEmail && userEmail === normalizedEmail) {
      return true;
    }

    if (normalizedPhone && userPhone === normalizedPhone) {
      return true;
    }

    return false;
  });

  if (!matchedUsers.length) {
    return { status: "ok" };
  }

  const matchedIds = matchedUsers.map((u) => u.id);
  const { data: links, error: linksError } = await supabase
    .from("account_auth_links")
    .select("auth_user_id, account_id")
    .in("auth_user_id", matchedIds);

  if (linksError) {
    throw linksError;
  }

  const conflicting =
    (links as Array<{ auth_user_id: string; account_id: string }> | null)?.find(
      (row) => row.account_id !== params.accountId,
    ) ?? null;

  if (conflicting) {
    console.warn("[ensureCredentialNotLinkedToDifferentAccount] cross-account credential conflict", {
      accountId: params.accountId,
      conflictingAccountId: conflicting.account_id,
    });
    throw new Error("That sign-in method is already linked to another account.");
  }

  const alreadyLinkedSameAccount =
    ((links as Array<{ auth_user_id: string; account_id: string }> | null) ?? []).length > 0;

  if (alreadyLinkedSameAccount) {
    return { status: "already_linked_same_account" };
  }

  return { status: "ok" };
}

export async function linkAuthUserToAccount(params: {
  accountId: string;
  authUserId: string;
}): Promise<{ linked: boolean; alreadyLinked: boolean }> {
  const supabase = createSupabaseAdminClient();
  let resolvedAccountId = params.accountId;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, is_active, merged_into_account_id")
    .eq("id", resolvedAccountId)
    .maybeSingle<{ id: string; is_active?: boolean | null; merged_into_account_id?: string | null }>();

  if (accountError) {
    throw accountError;
  }

  if (!account?.id) {
    throw new Error("Target account is not available for linking.");
  }

  if (account.merged_into_account_id) {
    const { data: mergedTarget, error: mergedTargetError } = await supabase
      .from("accounts")
      .select("id, is_active")
      .eq("id", account.merged_into_account_id)
      .maybeSingle<{ id: string; is_active?: boolean | null }>();

    if (mergedTargetError) {
      throw mergedTargetError;
    }

    if (!mergedTarget?.id || mergedTarget.is_active === false) {
      throw new Error("Target account is merged/inactive and cannot receive links.");
    }

    resolvedAccountId = mergedTarget.id;
    console.info("[linkAuthUserToAccount] resolved merged account target", {
      requestedAccountId: params.accountId,
      resolvedAccountId,
    });
  } else if (account.is_active === false) {
    throw new Error("Target account is not available for linking.");
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from("account_auth_links")
    .select("account_id")
    .eq("auth_user_id", params.authUserId)
    .maybeSingle<{ account_id: string }>();

  if (existingLinkError) {
    throw existingLinkError;
  }

  if (existingLink?.account_id && existingLink.account_id !== resolvedAccountId) {
    throw new Error("This sign-in method is already linked to another account.");
  }

  if (existingLink?.account_id === resolvedAccountId) {
    console.info("[linkAuthUserToAccount] already linked", {
      accountId: resolvedAccountId,
      authUserId: params.authUserId,
    });
    return { linked: true, alreadyLinked: true };
  }

  const { data: existingAccountLinks, error: existingAccountLinksError } = await supabase
    .from("account_auth_links")
    .select("auth_user_id")
    .eq("account_id", resolvedAccountId)
    .limit(1);

  if (existingAccountLinksError) {
    throw existingAccountLinksError;
  }

  const isPrimary = !((existingAccountLinks as Array<{ auth_user_id: string }> | null) ?? []).length;

  const { error: upsertError } = await supabase
    .from("account_auth_links")
    .upsert(
      {
        account_id: resolvedAccountId,
        auth_user_id: params.authUserId,
        is_primary: isPrimary,
      },
      { onConflict: "auth_user_id" },
    );

  if (upsertError) {
    throw upsertError;
  }

  console.info("[linkAuthUserToAccount] linked auth user to account", {
    accountId: resolvedAccountId,
    authUserId: params.authUserId,
    isPrimary,
  });

  return { linked: true, alreadyLinked: false };
}

export async function getAccountAuthLinkSummary(accountId: string): Promise<{
  accountId: string;
  linkedCount: number;
  primaryCount: number;
  emailCount: number;
  phoneCount: number;
}> {
  const methods = await listAccountAuthMethods(accountId);
  return {
    accountId,
    linkedCount: methods.length,
    primaryCount: methods.filter((method) => method.is_primary).length,
    emailCount: methods.filter((method) => Boolean(method.email)).length,
    phoneCount: methods.filter((method) => Boolean(method.phone)).length,
  };
}

/**
 * Admin/debug note:
 * - canonical source of linked sign-in methods is public.account_auth_links
 * - inspect with: select account_id, auth_user_id, is_primary, linked_at from public.account_auth_links where account_id = '<account_id>';
 * - expected steady state: >=1 row per active account, usually one is_primary=true
 */
