// Shared S&P 500 valuation fetch, used by both the API route and the Home page.
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

export type MarketValuation = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  dayLow: number;
  dayHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  // Indexes have no per-share earnings in FMP's data model, so these are usually null.
  trailingPE: number | null;
  eps: number | null;
  asOf: string;
  // Not sourced from FMP - FMP has no verified index-level CAPE series. Pending a Shiller import.
  cape: number | null;
};

export async function getMarketValuation(): Promise<MarketValuation | null> {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://financialmodelingprep.com/stable/quote?symbol=%5EGSPC&apikey=${apiKey}`,
    { next: { revalidate: 900 } },
  );

  if (!response.ok) {
    throw new Error(`FMP request failed with status ${response.status}`);
  }

  const data: FmpIndexQuote[] = await response.json();
  const quote = data[0];
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
    cape: null,
  };
}
