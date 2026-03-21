"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { AuthDialog } from "./AuthDialog";

type AuthEntryPointProps = {
  nextPath: string;
  linkPlayerId?: string;
  subtle?: boolean;
};

export function AuthEntryPoint({ nextPath, linkPlayerId, subtle = true }: AuthEntryPointProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    const resolveAccountLabel = async (user: User | null): Promise<string | null> => {
      if (!user?.id) {
        return null;
      }

      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        // Canonical profile key is profiles.id === auth.users.id.
        // Keep a backward-compatible fallback while older schemas may still include auth_user_id.
        .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
        .maybeSingle();

      const profile = data as { display_name?: string | null } | null;

      const profileDisplayName = profile?.display_name?.trim();
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

    const hydrateAccountState = async (user: User | null) => {
      setIsAuthenticated(Boolean(user?.id));

      const label = await resolveAccountLabel(user);

      if (!mounted) {
        return;
      }

      setAccountLabel(label ?? (user?.id ? "Account" : null));
      setIsLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => hydrateAccountState(data.user ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateAccountState(session?.user ?? null);
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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setAuthError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setIsMenuOpen(false);
      setIsAuthenticated(false);
      setAccountLabel(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign out";
      setAuthError(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthDialog
        label="Continue with email"
        nextPath={nextPath}
        linkPlayerId={linkPlayerId}
        emphasis={subtle ? "subtle" : "prominent"}
      />
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setIsMenuOpen((isOpen) => !isOpen);
          setAuthError(null);
        }}
        className="inline-flex h-8 max-w-[14rem] items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        <span className="truncate">{accountLabel}</span>
        <span aria-hidden>▾</span>
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <Link
            href="/me"
            onClick={() => setIsMenuOpen(false)}
            className="inline-flex h-8 w-full items-center rounded-md px-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Account
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex h-8 w-full items-center rounded-md px-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            role="menuitem"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
          {authError && <p className="px-2 pb-1 text-[11px] text-red-600">{authError}</p>}
        </div>
      )}
    </div>
  );
}