// Step (alert) logic shared by the UI and the stock check: trigger conditions, status and labels.
import type { Alert, AlertOperator } from "./types";

type Condition = { operator?: AlertOperator | string | null; price?: number | null };

// Whether the current price meets the step's condition; the operator defaults to ">".
export function meetsCondition(step: Condition, currentPrice: number): boolean {
  if (step.price == null) return false;
  return (step.operator ?? ">") === "<" ? currentPrice < step.price : currentPrice > step.price;
}

// "> 150"
export function formatAlertCondition(step: Condition): string {
  return `${step.operator ?? ">"} ${step.price ?? "?"}`;
}

// "AAPL > 150"
export function formatAlertLabel(step: Condition & { stock: string }): string {
  return `${step.stock} ${formatAlertCondition(step)}`;
}

// A step is "watching" while active, "done" once it fired, and "waiting" until a transition turns it on.
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

// The trigger prices of a step-up ladder: each `percent` above the one before, starting from `start`
// (so the first is already `percent` above it), rounded to cents.
export function stepUpPrices(start: number, count: number, percent: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(start * (1 + percent / 100) ** (i + 1) * 100) / 100);
}

// Steps within this % of their trigger price count as "near trigger" on the dashboard.
export const NEAR_TRIGGER_PERCENT = 2;

// How far (as % of the current price) the price still has to move for the step to fire; 0 once it's there.
export function distanceToTrigger(step: Condition, currentPrice: number): number | null {
  if (step.price == null || currentPrice === 0) return null;
  const gap = (step.operator ?? ">") === ">" ? step.price - currentPrice : currentPrice - step.price;
  return Math.max(0, (gap / currentPrice) * 100);
}
