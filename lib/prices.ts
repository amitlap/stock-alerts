// Stock prices from Yahoo Finance: live quotes for the dashboard and stock check, and a year of
// daily candles for a step's chart.
import "server-only";
import YahooFinance from "yahoo-finance2";
import type { Candle, StockPrice } from "./types";

const yahooFinance = new YahooFinance();

// Latest quote for each distinct symbol; no request at all for an empty list.
export async function getLatestStockPrices(tickers: string[]): Promise<StockPrice[]> {
  const symbols = [...new Set(tickers)];
  if (symbols.length === 0) return [];

  const quotes = await yahooFinance.quote(symbols);
  return quotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
  }));
}

export async function getHistoricalPrices(ticker: string): Promise<Candle[]> {
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);

  const { quotes } = await yahooFinance.chart(ticker, { period1, period2: new Date(), interval: "1d" });

  return quotes.flatMap(({ date, open, high, low, close }) =>
    open != null && high != null && low != null && close != null
      ? [{ time: date.toISOString().slice(0, 10), open, high, low, close }]
      : [],
  );
}
