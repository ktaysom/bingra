"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  readPlayerRecoveryFromStorage,
  removePlayerRecoveryFromStorage,
  removeStalePlayerRecoveryFromStorage,
} from "../../../lib/bingra/player-recovery-storage";

type JoinRecoveryGateProps = {
  slug: string;
  children: ReactNode;
};

type RecoveryState = "checking" | "recovering" | "show_join";

type RecoverPlayerResponse = {
  ok?: boolean;
  error?: string;
};

function isTransientFailureStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export function JoinRecoveryGate({ slug, children }: JoinRecoveryGateProps) {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const attemptedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (attemptedRef.current) {
      console.info("[auth][recovery] skipped", {
        slug,
        reason: "already_attempted_this_mount",
      });
      return;
    }

    attemptedRef.current = true;
    removeStalePlayerRecoveryFromStorage(slug);

    const recoveryRecord = readPlayerRecoveryFromStorage(slug);
    if (!recoveryRecord?.recoveryToken) {
      console.info("[auth][recovery] skipped", {
        slug,
        reason: "no_local_recovery_token",
      });
      setRecoveryState("show_join");
      return;
    }

    setRecoveryState("recovering");
    console.info("[auth][recovery] silent recovery attempt started", {
      slug,
      hasStoredPlayerId: Boolean(recoveryRecord.playerId),
    });

    void fetch(`/g/${slug}/recover-player`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ recoveryToken: recoveryRecord.recoveryToken }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as RecoverPlayerResponse | null;

        if (response.ok && payload?.ok) {
          console.info("[auth][recovery] silent recovery succeeded", {
            slug,
          });
          router.replace(`/g/${slug}/play`);
          router.refresh();
          return;
        }

        const errorCode = typeof payload?.error === "string" ? payload.error : "unknown";
        const isInvalidTokenFailure = response.status === 401 || errorCode === "invalid_token";

        if (isInvalidTokenFailure) {
          removePlayerRecoveryFromStorage(slug);
          console.warn("[auth][recovery] silent recovery failed; cleared local token", {
            slug,
            status: response.status,
            error: errorCode,
          });
        } else if (isTransientFailureStatus(response.status)) {
          console.warn("[auth][recovery] silent recovery failed; preserving token for retry", {
            slug,
            status: response.status,
            error: errorCode,
          });
        } else {
          console.warn("[auth][recovery] silent recovery failed; preserving token for retry", {
            slug,
            status: response.status,
            error: errorCode,
          });
        }

        setRecoveryState("show_join");
      })
      .catch(() => {
        console.warn("[auth][recovery] silent recovery failed; preserving token for retry", {
          slug,
          reason: "network_error",
        });
        setRecoveryState("show_join");
      });
  }, [router, slug]);

  if (recoveryState === "show_join") {
    return <>{children}</>;
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Restoring your game…
    </div>
  );
}
