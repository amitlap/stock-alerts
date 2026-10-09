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
  isActive: boolean;
  description?: string | null;
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
      isActive: alert.isActive,
      description: alert.description,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");

  return data;
}

export async function updateAlert(id: number, alert: NewAlert): Promise<Alert> {
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
    .update({
      stock: alert.stock.trim(),
      price: alert.price,
      operator: alert.operator,
      email: alert.email.trim(),
      isActive: alert.isActive,
      description: alert.description,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");

  return data;
}

export async function getAlertById(id: number): Promise<Alert | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .select("id, created_at, stock, email, price, operator, isActive, description")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getAllAlerts(): Promise<Alert[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .select("id, created_at, stock, email, price, operator, isActive");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function removeAlert(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("alerts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

