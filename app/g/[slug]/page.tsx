import type { Metadata } from "next";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { JoinForm } from "./JoinForm";
import { joinGameAction } from "../../actions/join-game";

type JoinPageProps = {
  params: {
    slug: string;
  };
};

type GameRecord = {
  id: string;
  slug: string;
  title: string | null;
};

export const metadata: Metadata = {
  title: "Join game",
};

export default async function JoinGamePage(props: JoinPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error } = await supabase
    .from("games")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  const showError = error || !game;

  if (showError) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
        <div className="rounded-2xl bg-white/90 p-8 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Join game</p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-900">We couldn&apos;t find that room</h1>
          <p className="mt-2 text-neutral-600">Double-check the link or ask the host to resend the invite.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white/90 p-8 shadow-md">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Join game</p>
          <h1 className="text-4xl font-semibold text-slate-900">{game.title ?? "Untitled game"}</h1>
          <p className="text-base text-slate-600">You&apos;ve been invited to join this game</p>
        </div>

        <JoinForm slug={slug} action={joinGameAction} />
      </section>
    </main>
  );
}