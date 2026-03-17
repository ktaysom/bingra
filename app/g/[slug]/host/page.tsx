import type { Metadata } from "next";

type HostPageProps = {
  params: {
    slug: string;
  };
};

export const metadata: Metadata = {
  title: "Host Game",
};

export default function HostPage({ params }: HostPageProps) {
  const { slug } = params;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Game slug</p>
        <h1 className="text-3xl font-semibold text-balance">Host Game</h1>
        <p className="mt-2 text-lg font-mono text-neutral-800">{slug}</p>
      </header>
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium">Host dashboard rebuild in progress</h2>
        <p className="mt-2 text-neutral-600">
          Thanks for creating a game. The host experience is being rebuilt—stay tuned for
          the refreshed controls here soon.
        </p>
      </section>
    </main>
  );
}