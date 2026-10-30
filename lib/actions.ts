"use server";

import YahooFinance from "yahoo-finance2";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { ALERT_OPERATORS, type AlertOperator, type Candle, type StockPrice } from "./stockUtils";

const yahooFinance = new YahooFinance();

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
  playbook_id: number;
};

// An alert is one step of a playbook; triggered_at records when it last fired.
export type Alert = NewAlert & {
  id: number;
  created_at: string;
  triggered_at: string | null;
};

const ALERT_COLUMNS =
  "id, created_at, stock, email, price, operator, isActive, description, playbook_id, triggered_at";

// Playbooks, their steps and the dashboard all show the same data, so refresh every page.
function revalidateApp() {
  revalidatePath("/", "layout");
}

// Validates an alert and normalizes the fields a user can edit.
function toAlertFields(alert: Omit<NewAlert, "playbook_id">) {
  if (!alert.stock.trim() || !alert.email.trim()) {
    throw new Error("Stock and email are required");
  }
  if (!Number.isFinite(alert.price)) {
    throw new Error("Price must be a number");
  }
  if (!ALERT_OPERATORS.includes(alert.operator)) {
    throw new Error("Invalid operator");
  }

  return {
    stock: alert.stock.trim().toUpperCase(),
    price: alert.price,
    operator: alert.operator,
    email: alert.email.trim(),
    isActive: alert.isActive,
    description: alert.description?.trim() || null,
  };
}

export async function addAlert(alert: NewAlert): Promise<Alert> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .insert({ ...toAlertFields(alert), playbook_id: alert.playbook_id })
    .select(ALERT_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();

  return data;
}

// Updates a step's editable fields; a step stays in the playbook it was created in.
export async function updateAlert(id: number, alert: NewAlert): Promise<Alert> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .update(toAlertFields(alert))
    .eq("id", id)
    .select(ALERT_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();

  return data;
}

export async function getAlertById(id: number): Promise<Alert | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from("alerts").select(ALERT_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function removeAlert(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("alerts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();
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

// The first step a new playbook starts watching.
export type FirstStep = Pick<NewAlert, "stock" | "operator" | "price">;

function toPlaybookFields(playbook: NewPlaybook) {
  if (!playbook.name.trim() || !playbook.email.trim()) {
    throw new Error("Name and email are required");
  }

  return {
    name: playbook.name.trim(),
    description: playbook.description.trim(),
    email: playbook.email.trim(),
  };
}

// Creates a playbook together with its first, active step.
export async function addPlaybook(playbook: NewPlaybook, firstStep: FirstStep): Promise<Playbook> {
  const fields = toPlaybookFields(playbook);
  const stepFields = toAlertFields({ ...firstStep, email: fields.email, isActive: true });

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from("playbooks").insert(fields).select().single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: stepError } = await supabase.from("alerts").insert({ ...stepFields, playbook_id: data.id });

  if (stepError) {
    // Don't leave a playbook with no steps behind.
    await supabase.from("playbooks").delete().eq("id", data.id);
    throw new Error(stepError.message);
  }

  revalidateApp();

  return data;
}

export async function updatePlaybook(id: number, playbook: NewPlaybook): Promise<Playbook> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .update(toPlaybookFields(playbook))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();

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

export type PlaybookWithSteps = Playbook & { alerts: Alert[] };

// The user's playbooks, newest first, each with its steps (for progress in lists and the dashboard).
export async function getPlaybooksWithSteps(email: string): Promise<PlaybookWithSteps[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("playbooks")
    .select(`id, created_at, name, description, email, alerts(${ALERT_COLUMNS})`)
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

// Deleting a playbook also deletes its steps and transitions (on delete cascade).
export async function removePlaybook(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("playbooks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();
}

export async function getAlertsByPlaybook(playbookId: number): Promise<Alert[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alerts")
    .select(ALERT_COLUMNS)
    .eq("playbook_id", playbookId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export type NewAlertTransition = {
  playbook_id: number;
  source_alert_id: number;
  target_alert_id: number;
  condition?: string | null;
  explanation?: string | null;
};

export type AlertTransition = NewAlertTransition & {
  id: number;
  created_at: string;
};

export async function getTransitionsByPlaybook(playbookId: number): Promise<AlertTransition[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alert_transitions")
    .select("id, created_at, playbook_id, source_alert_id, target_alert_id, condition, explanation")
    .eq("playbook_id", playbookId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

// Validates a transition and normalizes it into the row shape written to alert_transitions.
function toTransitionRow(transition: NewAlertTransition) {
  if (!transition.source_alert_id || !transition.target_alert_id) {
    throw new Error("Source and target alerts are required");
  }
  if (transition.source_alert_id === transition.target_alert_id) {
    throw new Error("Source and target alerts must be different");
  }

  return {
    playbook_id: transition.playbook_id,
    source_alert_id: transition.source_alert_id,
    target_alert_id: transition.target_alert_id,
    condition: transition.condition?.trim() || null,
    explanation: transition.explanation?.trim() || null,
  };
}

export async function addAlertTransition(transition: NewAlertTransition): Promise<AlertTransition> {
  const row = toTransitionRow(transition);
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alert_transitions")
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();

  return data;
}

export async function updateAlertTransition(
  id: number,
  transition: NewAlertTransition
): Promise<AlertTransition> {
  const row = toTransitionRow(transition);
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("alert_transitions")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();

  return data;
}

export async function removeAlertTransition(id: number): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("alert_transitions").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateApp();
}

