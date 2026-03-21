import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { AuthDialog } from "../../components/auth/AuthDialog";
import { SignOutButton } from "../../components/auth/SignOutButton";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
        <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">You&apos;re playing as a guest</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to attach games to your account and unlock upcoming career stats.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <AuthDialog label="Sign in" nextPath="/me" emphasis="prominent" />
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const profileData = profile as { id?: string; display_name?: string | null } | null;
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

  const identityLabel =
    profileData?.display_name?.trim() || metadataName?.trim() || user.email || user.phone || "Signed-in user";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{identityLabel}</h1>
        <p className="mt-2 text-sm text-slate-600">Career stats are coming soon. This page will become your Bingra profile hub.</p>

        <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auth user id</dt>
            <dd className="mt-1 break-all text-slate-800">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile id</dt>
            <dd className="mt-1 break-all text-slate-800">{profileData?.id ?? user.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 break-all text-slate-800">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
            <dd className="mt-1 break-all text-slate-800">{user.phone ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <SignOutButton redirectTo="/" />
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to game
          </Link>
        </div>
      </section>
    </main>
  );
}
