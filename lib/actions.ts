"use server";

import YahooFinance from "yahoo-finance2";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { AlertOperator, Candle, StockPrice } from "./stockUtils";

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

export async function getHistoricalPrices(ticker: string): Promise<Candle[]> {
  const period2 = new Date();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);

  const { quotes } = await yahooFinance.chart(ticker, {
    period1,
    period2,
    interval: "1d",
  });

  return quotes
    .filter(
      (quote) =>
        quote.open != null && quote.high != null && quote.low != null && quote.close != null,
    )
    .map((quote) => ({
      time: quote.date.toISOString().slice(0, 10),
      open: quote.open as number,
      high: quote.high as number,
      low: quote.low as number,
      close: quote.close as number,
    }));
}

export type NewAlert = {
  stock: string;
  price: number;
  operator: AlertOperator;
  email: string;
  isActive: boolean;
  description?: string | null;
  playbook_id?: number | null;
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
      playbook_id: alert.playbook_id ?? null,
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
      playbook_id: alert.playbook_id ?? null,
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
    .select("id, created_at, stock, email, price, operator, isActive, description, playbook_id")
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

export type NewPlaybook = {
  name: string;
  description: string;
  email: string;
};

export type Playbook = NewPlaybook & {
  id: number;
  created_at: string;
};

export async function addPlaybook(playbook: NewPlaybook): Promise<Playbook> {
  if (!playbook.name.trim() || !playbook.description.trim() || !playbook.email.trim()) {
    throw new Error("Name, description and email are required");
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .insert({
      name: playbook.name.trim(),
      description: playbook.description.trim(),
      email: playbook.email.trim(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/playbooks");

  return data;
}

export async function updatePlaybook(id: number, playbook: NewPlaybook): Promise<Playbook> {
  if (!playbook.name.trim() || !playbook.description.trim() || !playbook.email.trim()) {
    throw new Error("Name, description and email are required");
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .update({
      name: playbook.name.trim(),
      description: playbook.description.trim(),
      email: playbook.email.trim(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/playbooks");
  revalidatePath(`/playbooks/${id}`);

  return data;
}

export async function getPlaybookById(id: number): Promise<Playbook | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .select("id, created_at, name, description, email")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getPlaybooksByEmail(email: string): Promise<Playbook[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .select("id, created_at, name, description, email")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function removePlaybook(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("playbooks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/playbooks");
}

export async function getAlertsByPlaybook(playbookId: number): Promise<Alert[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .select("id, created_at, stock, email, price, operator, isActive, description, playbook_id")
    .eq("playbook_id", playbookId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

// Links or unlinks an alert to a playbook; pass null to remove it from its current playbook.
export async function setAlertPlaybook(alertId: number, playbookId: number | null): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("alerts")
    .update({ playbook_id: playbookId })
    .eq("id", alertId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/playbooks");
  if (playbookId != null) {
    revalidatePath(`/playbooks/${playbookId}`);
  }
}

