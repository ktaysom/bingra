import { createSupabaseBrowserClient } from "../supabase/browser";

function isPasswordAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === "1";
}

export async function updateAuthenticatedUserPassword(params: {
  password: string;
}) {
  if (!isPasswordAuthEnabled()) {
    throw new Error("Password management is currently unavailable.");
  }

  const password = params.password;
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error("Your session expired. Please sign in again with email code.");
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw error;
  }
}
