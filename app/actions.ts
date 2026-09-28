"use server";

import YahooFinance from "yahoo-finance2";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { AlertOperator, StockPrice } from "./stockUtils";

const yahooFinance = new YahooFinance();
const ALERT_OPERATORS: AlertOperator[] = [">", "<"];

export async function getLatestStockPrices(tickers: string[]): Promise<StockPrice[]> {
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

export type NewAlert = {
  stock: string;
  price: number;
  operator: AlertOperator;
  email: string;
};

export type Alert = NewAlert & {
  id: number;
  created_at: string;
};

export async function addAlert(alert: NewAlert): Promise<Alert> {
  if (!alert.stock.trim() || !alert.email.trim()) {
    throw new Error("Stock and email are required");
  }
  if (!Number.isFinite(alert.price)) {
    throw new Error("Price must be a number");
  }
  if (!ALERT_OPERATORS.includes(alert.operator)) {
    throw new Error("Invalid operator");
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .insert({
      stock: alert.stock.trim(),
      price: alert.price,
      operator: alert.operator,
      email: alert.email.trim(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");

  return data;
}

export async function removeAlert(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("alerts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

