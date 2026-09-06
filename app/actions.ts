"use server";

import { Resend } from "resend";
import YahooFinance from "yahoo-finance2";
import { unstable_cache } from "next/cache";

const yahooFinance = new YahooFinance();

export async function getLatestStockPrices(tickers: string[]) {
  const quotes = await yahooFinance.quote(tickers);

  const list = quotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
  }));

  console.log(list);

  return list;
}

type StockPrice = Awaited<ReturnType<typeof getLatestStockPrices>>[number];

export function isBigChange(stock: StockPrice) {
  if (!stock) return false;
  if (stock.symbol !== "NVDA") return false;
  
  return (stock.change ?? 0) > 2 || (stock.price ?? 0) > 233;
}

