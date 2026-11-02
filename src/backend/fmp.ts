// Financial Modeling Prep: the live S&P 500 quote for the dashboard, and upcoming earnings reports
// for the earnings reminders.
import "server-only";
import type { MarketValuation } from "@/shared/types";

const FMP_URL = "https://financialmodelingprep.com/stable";

function fmpUrl(path: string, params: Record<string, string>) {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) throw new Error("FMP_KEY must be configured");
  return `${FMP_URL}/${path}?${new URLSearchParams({ ...params, apikey: apiKey })}`;
}

type FmpIndexQuote = {
  symbol: string;
  price: number;
  changePercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  pe?: number | null;
  eps?: number | null;
  timestamp: number;
};

// The S&P 500 quote, or null when FMP_KEY isn't set or FMP has no quote.
export async function getMarketValuation(): Promise<MarketValuation | null> {
  if (!process.env.FMP_KEY) return null;

  const response = await fetch(fmpUrl("quote", { symbol: "^GSPC" }), { next: { revalidate: 900 } });
  if (!response.ok) {
    throw new Error(`FMP request failed with status ${response.status}`);
  }

  const [quote]: FmpIndexQuote[] = await response.json();
  if (!quote) return null;

  return {
    symbol: "^GSPC",
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercentage,
    dayLow: quote.dayLow,
    dayHigh: quote.dayHigh,
    fiftyTwoWeekLow: quote.yearLow,
    fiftyTwoWeekHigh: quote.yearHigh,
    trailingPE: quote.pe ?? null,
    eps: quote.eps ?? null,
    asOf: new Date(quote.timestamp * 1000).toISOString(),
  };
}

export type EarningsReport = {
  symbol: string;
  date: string; // "YYYY-MM-DD"
  epsEstimated: number | null;
  revenueEstimated: number | null;
};

// The next scheduled report after `today`, or null when FMP has none or doesn't cover the symbol
// (our plan gets a "premium" text reply instead of a list for ETFs).
export async function getNextEarnings(symbol: string, today: string): Promise<EarningsReport | null> {
  const response = await fetch(fmpUrl("earnings", { symbol, limit: "5" }), { cache: "no-store" });
  if (!response.ok) return null;

  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) return null;

  return (
    (data as EarningsReport[])
      .filter((report) => report.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}
