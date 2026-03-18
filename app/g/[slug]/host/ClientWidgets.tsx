"use client";

import { useState } from "react";

type InviteLinkCardProps = {
  joinUrl: string;
};

export function InviteLinkCard({ joinUrl }: InviteLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy invite link", error);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite link</p>
          <p className="mt-1 break-all font-mono text-sm text-slate-900">{joinUrl}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}

type GameControlsCardProps = {
  playerCount: number;
};

export function GameControlsCard({ playerCount }: GameControlsCardProps) {
  const handleStartGame = () => {
    console.log("[startGame] Game start flow not implemented yet", { playerCount });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Game controls</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Waiting for players</p>
          <p className="text-sm text-slate-500">{playerCount} joined</p>
        </div>
        <button
          type="button"
          onClick={handleStartGame}
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Start game
        </button>
      </div>
    </section>
  );
}