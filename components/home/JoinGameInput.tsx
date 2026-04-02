"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

function extractGameSlug(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  const fromPathMatch = value.match(/\/g\/([^/?#]+)/i);
  if (fromPathMatch?.[1]) {
    return fromPathMatch[1].trim();
  }

  return value.replace(/^\/+/, "").split(/[/?#]/)[0].trim();
}

export function JoinGameInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = extractGameSlug(value);
    if (!slug) {
      return;
    }

    router.push(`/g/${slug}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://.../g/game-slug or game-slug"
        className="h-11 w-full rounded-lg border border-bingra-gray-light px-4 text-sm text-bingra-dark placeholder:text-bingra-gray-medium focus:border-bingra-dark focus:outline-none"
        aria-label="Game invite link or code"
      />
      <button
        type="submit"
        className="h-11 rounded-lg bg-bingra-dark px-5 text-sm font-semibold text-white"
      >
        Join
      </button>
    </form>
  );
}
