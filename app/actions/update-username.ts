"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { normalizeUsernameInput } from "../../lib/auth/profiles";

export type UpdateUsernameFormState = {
  success?: boolean;
  error?: string;
  username?: string;
};

const updateUsernameSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

export async function updateUsernameAction(
  _prevState: UpdateUsernameFormState,
  formData: FormData,
): Promise<UpdateUsernameFormState> {
  const parsed = updateUsernameSchema.safeParse({
    username: typeof formData.get("username") === "string" ? formData.get("username") : "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }

  const normalizedUsername = normalizeUsernameInput(parsed.data.username);

  if (normalizedUsername.length < 3) {
    return {
      error: "Username must be at least 3 characters and contain only letters, numbers, underscores, dots, or dashes.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { error: "You must be signed in to update your username." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: normalizedUsername })
    .eq("id", user.id)
    .limit(1);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "That username is already taken. Try another one." };
    }

    return { error: error.message };
  }

  revalidatePath("/me");

  return {
    success: true,
    username: normalizedUsername,
  };
}
