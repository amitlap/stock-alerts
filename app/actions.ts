"use server";

import { Resend } from "resend";
import YahooFinance from "yahoo-finance2";
import { unstable_cache } from "next/cache";

const yahooFinance = new YahooFinance();

export async function getLatestStockPrices(tickers: string[]) {
  const quotes = await yahooFinance.quote(tickers);

  return quotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
  }));
}
