"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { AuthDialog } from "./AuthDialog";

type AuthEntryPointProps = {
  nextPath: string;
  linkPlayerId?: string;
  subtle?: boolean;
};

export function AuthEntryPoint({ nextPath, linkPlayerId, subtle = true }: AuthEntryPointProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setEmail(data.user?.email ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      setEmail(session?.user?.email ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-400">
        ...
      </div>
    );
  }

  if (!email) {
    return (
      <AuthDialog
        label="Sign in"
        nextPath={nextPath}
        linkPlayerId={linkPlayerId}
        emphasis={subtle ? "subtle" : "prominent"}
      />
    );
  }

  return (
    <div className="inline-flex h-8 max-w-[14rem] items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
      <span className="truncate">{email}</span>
    </div>
  );
}