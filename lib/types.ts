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

// "When source fires, target starts watching."
export type AlertTransition = {
  id: number;
  created_at: string;
  playbook_id: number;
  source_alert_id: number;
  target_alert_id: number;
  condition: string | null;
  explanation: string | null;
};

export type PlaybookWithSteps = Playbook & { alerts: Alert[] };

// The first step a new playbook starts watching.
export type FirstStep = Pick<NewAlert, "stock" | "operator" | "price">;

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
