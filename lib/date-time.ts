const ACTIVITY_FEED_TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const SHORT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

function toValidDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatViewerLocalActivityTimestamp(value: string | Date): string {
  const date = toValidDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, ACTIVITY_FEED_TIMESTAMP_OPTIONS).format(date);
}

export function formatViewerLocalShortTime(value: string | Date): string {
  const date = toValidDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, SHORT_TIME_OPTIONS).format(date);
}