// Small display and input helpers, safe to use on the server and in the browser.

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Parses a price input; null when it's blank or not a finite number.
export function parsePrice(value: string): number | null {
  const price = Number(value);
  return value.trim() !== "" && Number.isFinite(price) ? price : null;
}

// Shortens text longer than `max` characters, ending it with "…".
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function priceChangeColor(change?: number | null) {
  return (change ?? 0) >= 0 ? "success.main" : "error.main";
}

// "5 minutes ago", "2 days ago".
export function formatTimeAgo(date: string | Date, now = new Date()): string {
  const seconds = (new Date(date).getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// "2026-10-01" -> "Oct 2026"
export function formatMonthYear(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
