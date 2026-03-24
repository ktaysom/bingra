"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthDialog } from "./AuthDialog";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

type EndGameSaveStatsPromptProps = {
  gameId: string;
  slug: string;
  playerId: string;
  isFinished: boolean;
};

export function EndGameSaveStatsPrompt({
  gameId,
  slug,
  playerId,
  isFinished,
}: EndGameSaveStatsPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<"hidden" | "guest" | "saved">("hidden");
  const [isLoading, setIsLoading] = useState(true);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isFinished || !gameId || !playerId) {
      setIsLoading(false);
      setMode("hidden");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const resolveAccountLabel = async (user: {
      id?: string;
      email?: string | null;
      phone?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      let profileDisplayName = "";

      if (user.id) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
          .maybeSingle();

        const profile = data as { display_name?: string | null } | null;
        profileDisplayName = profile?.display_name?.trim() ?? "";
      }

      const metadataDisplayName =
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name.trim()
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name.trim()
              : "";

      return profileDisplayName || metadataDisplayName || user.email || user.phone || null;
    };

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (data.user?.id) {
        setAccountLabel(await resolveAccountLabel(data.user));
        setMode("saved");

        setIsLoading(false);
        return;
      }

      setMode(dismissed ? "hidden" : "guest");

      setIsLoading(false);
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!mounted) {
          return;
        }

        if (session?.user?.id) {
          setAccountLabel(await resolveAccountLabel(session.user));
          setMode("saved");
        } else {
          setMode(dismissed ? "hidden" : "guest");
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [dismissed, gameId, isFinished, playerId]);

  if (!isFinished || isLoading || mode === "hidden") {
    return null;
  }

  const isSaved = mode === "saved";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Game complete</p>
        {isSaved ? (
          <>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Stats saved</h3>
            <p className="mt-2 text-sm text-slate-600">This game is now attached to your account.</p>
            {accountLabel ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">Signed in as {accountLabel}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setMode("hidden");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Save your stats</h3>
            <p className="mt-2 text-sm text-slate-600">
              Keep your result, unlock career tracking, and build your Bingra history.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <AuthDialog
                label="Sign in"
                nextPath={`/g/${slug}/play`}
                linkPlayerId={playerId}
                emphasis="prominent"
              />
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setMode("hidden");
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Maybe later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}