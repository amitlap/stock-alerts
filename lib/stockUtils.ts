export type StockPrice = {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type AlertOperator = ">" | "<";

export const ALERT_OPERATORS: AlertOperator[] = [">", "<"];

export type Alert = {
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
  triggered_at?: string | null;
  id?: number;
};

export function isBigChange(stock: StockPrice) {
  if (!stock) return false;
  if (stock.symbol !== "NVDA") return false;

  return (stock.change ?? 0) > 2 || (stock.price ?? 0) > 233;
}

function meetsCondition(currentPrice: number, operator: AlertOperator, targetPrice: number) {
  switch (operator) {
    case ">":
      return currentPrice > targetPrice;
    case "<":
      return currentPrice < targetPrice;
  }
}

// Alerts whose condition (=, >, <) against the target price is met by the stock's current live price.
export function getMatchingAlerts<T extends Alert>(alerts: T[], stocks: StockPrice[]): T[] {
  return alerts.filter((alert) => {
    if (alert.isActive === false) return false;

    const stock = stocks.find((s) => s.symbol === alert.stock);
    if (!stock || stock.price == null || alert.price == null) return false;

    return meetsCondition(stock.price, alert.operator ?? ">", alert.price);
  });
}

type AlertCondition = { operator?: string | null; price?: number | null };

// "> 150" — the alert's trigger condition, defaulting the operator to ">".
export function formatAlertCondition(alert: AlertCondition): string {
  return `${alert.operator ?? ">"} ${alert.price ?? "?"}`;
}

// "AAPL > 150"
export function formatAlertLabel(alert: AlertCondition & { stock: string }): string {
  return `${alert.stock} ${formatAlertCondition(alert)}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Parses a price input; null when it's blank or not a finite number.
export function parsePrice(value: string): number | null {
  const price = Number(value);
  return value.trim() !== "" && Number.isFinite(price) ? price : null;
}

export function priceChangeColor(change?: number | null) {
  return (change ?? 0) >= 0 ? "success.main" : "error.main";
}

// A playbook step is "watching" while active, "done" once it fired, and "waiting" until a transition turns it on.
export type StepStatus = "waiting" | "watching" | "done";

type StepState = Pick<Alert, "isActive" | "triggered_at">;

export function getStepStatus(step: StepState): StepStatus {
  if (step.isActive !== false) return "watching";
  return step.triggered_at ? "done" : "waiting";
}

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  waiting: "Waiting",
  watching: "Watching",
  done: "Done",
};

export function getPlaybookProgress(steps: StepState[]) {
  const counts: Record<StepStatus, number> = { waiting: 0, watching: 0, done: 0 };
  for (const step of steps) counts[getStepStatus(step)]++;
  return { ...counts, total: steps.length };
}
