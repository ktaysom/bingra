"use client";

import { useEffect, useState } from "react";
import { formatViewerLocalActivityTimestamp } from "../../lib/date-time";

type ViewerLocalTimestampProps = {
  iso: string;
  className?: string;
  placeholder?: string;
};

export function ViewerLocalTimestamp({
  iso,
  className,
  placeholder = "--",
}: ViewerLocalTimestampProps) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    setFormatted(formatViewerLocalActivityTimestamp(iso));
  }, [iso]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatted || placeholder}
    </time>
  );
}
