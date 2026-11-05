// The app's data shapes, shared by the server (queries, actions, jobs) and the UI.

export type AlertOperator = ">" | "<";

export const ALERT_OPERATORS: AlertOperator[] = [">", "<"];

export type NewPlaybook = {
  name: string;
  description: string;
  email: string;
};

export type Playbook = NewPlaybook & {
  id: number;
  created_at: string;
};

export type NewAlert = {
  stock: string;
  price: number;
  operator: AlertOperator;
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

// "When source fires, target starts watching."
export type AlertTransition = {
  id: number;
  created_at: string;
  playbook_id: number;
  source_alert_id: number;
  target_alert_id: number;
  explanation: string | null;
};

export type PlaybookWithSteps = Playbook & { alerts: Alert[] };

// A step of a new playbook. A new playbook's steps form a chain: the first watches right away, and each
// later one starts when the one before it fires (`explanation` says why, on that link).
export type PlannedStep = Pick<NewAlert, "stock" | "operator" | "price"> & {
  description?: string | null;
  explanation?: string | null;
};

// The existing step a step follows: when `sourceAlertId` fires, the step starts watching.
export type StepSource = { sourceAlertId: number; explanation?: string | null };

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

// The S&P 500 quote from FMP.
export type MarketValuation = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  dayLow: number;
  dayHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  // Indexes have no per-share earnings in FMP's data model, so these are usually null.
  trailingPE: number | null;
  eps: number | null;
  asOf: string;
};

// S&P 500 valuation history from Shiller's monthly dataset.
export type ValuationPoint = { time: string; value: number }; // time: "YYYY-MM-01"

export type ValuationHistory = {
  pe: ValuationPoint[]; // price / trailing 12-month earnings; earnings lag a few months
  cape: ValuationPoint[]; // price / 10-year average real earnings
};
