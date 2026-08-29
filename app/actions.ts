"use server";

import { Resend } from "resend";
import YahooFinance from "yahoo-finance2";
import { unstable_cache } from "next/cache";

const yahooFinance = new YahooFinance();

export async function getStockPrice(ticker: string) {
  const quote = await yahooFinance.quote(ticker);

  if (!quote.regularMarketPrice) {
    throw new Error(`No price found for ticker "${ticker}"`);
  }

  return quote.regularMarketPrice;
}

export async function getLatestStockPrices(tickers: string[]) {
  const quotes = await yahooFinance.quote(tickers);

  return quotes.map((quote) => ({
    symbol: quote.symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
  }));
}

const getCachedStockPrices = unstable_cache(
  async (tickers: string[]) => getLatestStockPrices(tickers),
  ["stock-prices"],
  { revalidate: 900 },
);

export async function getStockPrices(tickers: string[]) {
  return getCachedStockPrices(tickers);
}

export async function saveOrder(formData: FormData) {
  const apiKey = process.env.EMAIL_KEY;

  if (!apiKey) {
    throw new Error("EMAIL_KEY is not set in .env");
  }

  const ticker = String(formData.get("ticker") ?? "");
  const price = String(formData.get("price") ?? "");

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: "amitlapid711@gmail.com",
    to: "amitlapid711@gmail.com",
    subject: `Stock Order: ${ticker}`,
    html: `s
      <p>New order submitted.</p>
      <p><strong>Ticker:</strong> ${ticker}</p>
      <p><strong>Price:</strong> ${price}</p>
    `,
  });
}
