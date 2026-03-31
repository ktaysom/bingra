"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LastGameFallbackProps = {
  showWhenListEmpty: boolean;
  excludedSlug?: string | null;
};

export function LastGameFallback({ showWhenListEmpty, excludedSlug }: LastGameFallbackProps) {
  const [lastGameSlug, setLastGameSlug] = useState<string | null>(null);

  useEffect(() => {
    const value = window.localStorage.getItem("bingra-last-game")?.trim() || null;
    if (!value || value === excludedSlug) {
      setLastGameSlug(null);
      return;
    }

    setLastGameSlug(value);
  }, [excludedSlug]);

  if (!showWhenListEmpty || !lastGameSlug) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
      <p className="text-xs font-semibold uppercase tracking-wide">Return to your last game</p>
      <Link href={`/g/${lastGameSlug}/play`} className="mt-1 inline-flex font-semibold underline">
        Open /g/{lastGameSlug}/play
      </Link>
    </div>
  );
}
