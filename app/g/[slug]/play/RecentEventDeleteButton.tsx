"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteScoredEventAction,
  type DeleteScoredEventFormState,
} from "../../../actions/delete-scored-event";

type RecentEventDeleteProps = {
  slug: string;
  recordedEventId: string;
};

export function RecentEventDeleteButton({ slug, recordedEventId }: RecentEventDeleteProps) {
  const [state, setState] = useState<DeleteScoredEventFormState>({});
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("recordedEventId", recordedEventId);
      const result = await deleteScoredEventAction({}, formData);
      setState(result);
    });
  }

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={state.success}
      className="text-[11px] text-red-500"
    >
      delete
    </button>
  );
}