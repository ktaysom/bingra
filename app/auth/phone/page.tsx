import { PhoneAuthForm } from "../../../components/auth/PhoneAuthForm";
import Link from "next/link";

function normalizeNextPath(input: string | string[] | undefined): string {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return "/me";
  }

  return input;
}

type PhoneAuthPageProps = {
  searchParams?: Promise<{
    next?: string;
    link_player_id?: string;
  }>;
};

export default async function PhoneAuthPage({ searchParams }: PhoneAuthPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const nextPath = normalizeNextPath(params?.next);
  const linkPlayerId = params?.link_player_id;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="rounded-2xl bg-white/90 p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Continue with phone</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your phone number and we&apos;ll text you a secure one-time code.
        </p>

        <PhoneAuthForm nextPath={nextPath} linkPlayerId={linkPlayerId} />

        <p className="mt-4 text-xs text-slate-500">
          Prefer email? Open the <Link href="/me" className="underline">sign-in dialog</Link> and choose Continue with
          email.
        </p>
      </section>
    </main>
  );
}
