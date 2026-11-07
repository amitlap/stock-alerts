"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlaybook, getPriceLevel, getStockPrice } from "@/backend/actions";
import { useAsyncAction } from "@/frontend/hooks";
import { parsePrice } from "@/shared/format";
import { buildPlan, CRASH_DEFAULT_STOCK, levelKind, PLAN_DEFAULTS, type PlanTemplate } from "@/shared/playbookTemplates";
import { formatAlertLabel } from "@/shared/steps";
import type { PlannedStep } from "@/shared/types";
import { EMPTY_CONDITION } from "./StepFields";

export { levelKind, MAX_LADDER_STEPS, type PlanTemplate } from "@/shared/playbookTemplates";

// The kinds of playbook the new-playbook form can make; the plan templates are worked out from a stock
// and a start price (the plan fields).
export type PlaybookTemplate = "alert" | "custom" | PlanTemplate;

// Each type's `hint` shows under the type field; `about` is the longer explanation behind its info icon:
// what it does, and when it's useful.
export const PLAYBOOK_TEMPLATES: { value: PlaybookTemplate; label: string; hint: string; about: string }[] = [
  {
    value: "alert",
    label: "Price alert",
    hint: "One alert on one stock.",
    about:
      "The simplest playbook: you get an email (and a Telegram message, if connected) when one stock goes above or below a price you pick. Good for a single level you care about.",
  },
  {
    value: "custom",
    label: "Custom playbook",
    hint: "Start with one step, then add the steps that follow.",
    about:
      "Build your own plan step by step. Each step is a price alert, and you choose which step starts after which, so you can model any \"if this, then watch for that\" plan.",
  },
  {
    value: "stepUp",
    label: "Buy as price rises",
    hint: "A ladder of buy alerts, each a set % above the one before. Each starts when the one before fires.",
    about:
      "For adding to a position while it proves itself. Instead of buying everything at once, you buy a bit more each time the price climbs another few %, so most of your money goes in only after the trend is confirmed.",
  },
  {
    value: "dip",
    label: "Buy the dip",
    hint: "A ladder of buy alerts, each a set % below the one before. Each starts when the one before fires.",
    about:
      "For buying a stock you like at better prices. You buy a bit at each step down instead of guessing the bottom, which spreads your entry and lowers your average price if it keeps falling.",
  },
  {
    value: "crash",
    label: "Market crash plan",
    hint: "Alerts when an index falls 10%, 20% and 30% from today, each a cue to put a third of your cash to work.",
    about:
      "A plan made in calm times for when the market panics. It watches an index (SPY by default) and tells you when it's 10%, 20% and 30% below today, so you invest your cash in thirds instead of freezing or going all in too early.",
  },
  {
    value: "bracket",
    label: "Exit bracket",
    hint: "A stop loss below and a take profit above your entry price, both watching from the start.",
    about:
      "For a position you already hold. A stop loss below your entry limits how much you can lose, and a take profit above it locks in a gain. Both watch at the same time; note that when one fires, the other keeps watching until you remove it.",
  },
  {
    value: "breakout",
    label: "Resistance breakout",
    hint: "An alert when the price breaks 1% above resistance, then one when it pulls back to it (a lower-risk buy).",
    about:
      "Resistance is a price the stock kept failing to rise above; here it's the highest price of the last 3 months. A break above it often starts a new move up. The second alert waits for the price to come back to that old level, which often acts as a floor, for a lower-risk buy. Alerts use the live price, not the daily close, so a brief poke above can still trigger it.",
  },
  {
    value: "support",
    label: "Support bounce",
    hint: "An alert when the price comes within 2% of support (a buy zone), then one if it breaks 3% below.",
    about:
      "Support is a price the stock kept bouncing up from; here it's the lowest price of the last 3 months. The first alert tells you it's near that level, a common place to buy. If it then falls 3% below, the support has failed, and the second alert tells you to get out.",
  },
];

export function isPlanTemplate(template: PlaybookTemplate): template is PlanTemplate {
  return template !== "alert" && template !== "custom";
}

export type PlanDraft = {
  stock: string;
  startPrice: string;
  count: string;
  percent: string;
  stopPercent: string;
  targetPercent: string;
};

const EMPTY_PLAN: PlanDraft = {
  stock: "",
  startPrice: "",
  count: String(PLAN_DEFAULTS.count),
  percent: String(PLAN_DEFAULTS.percent),
  stopPercent: String(PLAN_DEFAULTS.stopPercent),
  targetPercent: String(PLAN_DEFAULTS.targetPercent),
};

// The plan fields as numbers; a blank or non-numeric field becomes NaN, which buildPlan rejects.
function planInput(template: PlanTemplate, draft: PlanDraft) {
  const num = (value: string) => parsePrice(value) ?? NaN;
  return buildPlan(template, {
    stock: draft.stock,
    start: num(draft.startPrice),
    count: num(draft.count),
    percent: num(draft.percent),
    stopPercent: num(draft.stopPercent),
    targetPercent: num(draft.targetPercent),
  });
}

// Form state for creating a playbook of one type; on success it opens the new playbook.
export function useNewPlaybook(userEmail: string, template: PlaybookTemplate) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState(EMPTY_CONDITION);
  // The crash plan is about the whole market, so it starts on SPY.
  const [plan, setPlan] = useState(() => (template === "crash" ? { ...EMPTY_PLAN, stock: CRASH_DEFAULT_STOCK } : EMPTY_PLAN));
  const save = useAsyncAction();
  const lookup = useAsyncAction();

  const price = parsePrice(condition.price);
  const planned = isPlanTemplate(template) ? planInput(template, plan) : null;
  const steps: PlannedStep[] | null = isPlanTemplate(template)
    ? (planned?.steps ?? null)
    : condition.stock.trim() && price !== null
      ? [{ stock: condition.stock.trim().toUpperCase(), operator: condition.operator, price }]
      : null;

  // Every template but a custom playbook gets a name from its fields when left blank.
  const defaultName =
    !steps || template === "custom" ? "" : template === "alert" ? formatAlertLabel(steps[0]) : (planned?.name ?? "");
  const canSave = steps !== null && (name.trim() !== "" || defaultName !== "");

  // "Use current" / "Find level": fills the start price with the stock's live price, or for the
  // breakout and support templates with its 3-month resistance or support.
  function fillStartPrice() {
    const stock = plan.stock.trim().toUpperCase();
    const kind = isPlanTemplate(template) ? levelKind(template) : null;
    return lookup.run(async () => {
      let start: number | null;
      if (kind) {
        const level = await getPriceLevel(stock, kind);
        if (level.error !== null) throw new Error(level.error);
        start = level.price;
      } else {
        const current = await getStockPrice(stock);
        start = current == null ? null : Math.floor(current);
      }
      if (start == null) throw new Error(`No price found for ${stock}`);
      setPlan((draft) => ({ ...draft, startPrice: String(start) }));
    });
  }

  function create() {
    if (!steps) return Promise.resolve(false);
    return save.run(async () => {
      const playbook = await addPlaybook(
        { name: name.trim() || defaultName, description, email: userEmail },
        steps,
      );
      router.push(`/playbooks/${playbook.id}`);
    });
  }

  return {
    name,
    setName,
    defaultName,
    description,
    setDescription,
    condition,
    setCondition,
    plan,
    setPlan,
    steps,
    canSave,
    create,
    save,
    lookup,
    fillStartPrice,
  };
}
