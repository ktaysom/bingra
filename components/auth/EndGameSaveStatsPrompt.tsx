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
  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = useMemo(() => `bingra-save-stats-prompt-${gameId}`, [gameId]);

  useEffect(() => {
    let mounted = true;

    if (!isFinished) {
      setIsLoading(false);
      setShouldShow(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (data.user?.id) {
        setShouldShow(false);
        setIsLoading(false);
        return;
      }

      const alreadySeen = window.sessionStorage.getItem(storageKey);
      if (alreadySeen) {
        setShouldShow(false);
      } else {
        window.sessionStorage.setItem(storageKey, "1");
        setShouldShow(true);
      }

      setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [isFinished, storageKey]);

  if (!isFinished || isLoading || !shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Game complete</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Save your stats</h3>
        <p className="mt-2 text-sm text-slate-600">
          Keep your result, unlock career tracking, and build your Bingra history.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AuthDialog
            label="Save stats with account"
            nextPath={`/g/${slug}/play`}
            linkPlayerId={playerId}
            emphasis="prominent"
          />
          <button
            type="button"
            onClick={() => setShouldShow(false)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}