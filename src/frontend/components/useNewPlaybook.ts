"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlaybook, getStockPrice } from "@/backend/actions";
import { useAsyncAction } from "@/frontend/hooks";
import { parsePrice } from "@/shared/format";
import { formatAlertLabel, stepUpPrices } from "@/shared/steps";
import type { PlannedStep } from "@/shared/types";
import { EMPTY_CONDITION } from "./StepFields";

// The kinds of playbook the new-playbook form can make.
export type PlaybookTemplate = "alert" | "custom" | "stepUp";

export const PLAYBOOK_TEMPLATES: { value: PlaybookTemplate; label: string; hint: string }[] = [
  { value: "alert", label: "Price alert", hint: "One alert on one stock." },
  { value: "custom", label: "Custom playbook", hint: "Start with one step, then add the steps that follow." },
  {
    value: "stepUp",
    label: "Buy as price rises",
    hint: "A ladder of buy alerts, each a set % above the one before. Each starts when the one before fires.",
  },
];

export const MAX_STEP_UP_STEPS = 20;

export type StepUpDraft = { stock: string; startPrice: string; count: string; percent: string };

const EMPTY_STEP_UP: StepUpDraft = { stock: "", startPrice: "", count: "5", percent: "7" };

// The steps of a "Buy as price rises" playbook, or null while the form is incomplete.
function stepUpSteps({ stock, startPrice, count, percent }: StepUpDraft): PlannedStep[] | null {
  const start = parsePrice(startPrice);
  const steps = Number(count);
  const pct = parsePrice(percent);
  if (!stock.trim() || start === null || start <= 0 || pct === null || pct <= 0) return null;
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEP_UP_STEPS) return null;

  return stepUpPrices(start, steps, pct).map((price, i) => ({
    stock: stock.trim().toUpperCase(),
    operator: ">",
    price,
    description: `Buy #${i + 1}: +${Math.round(((price / start - 1) * 100) * 10) / 10}% from $${start}`,
    explanation: i === 0 ? null : `Price rose another ${pct}%`,
  }));
}

// Form state for creating a playbook from a template; on success it opens the new playbook.
export function useNewPlaybook(userEmail: string) {
  const router = useRouter();
  const [template, setTemplate] = useState<PlaybookTemplate>("alert");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState(EMPTY_CONDITION);
  const [stepUp, setStepUp] = useState(EMPTY_STEP_UP);
  const save = useAsyncAction();
  const lookup = useAsyncAction();

  const price = parsePrice(condition.price);
  const steps: PlannedStep[] | null =
    template === "stepUp"
      ? stepUpSteps(stepUp)
      : condition.stock.trim() && price !== null
        ? [{ stock: condition.stock.trim().toUpperCase(), operator: condition.operator, price }]
        : null;

  // A price alert or ladder gets a name from its fields when left blank; a custom playbook needs one.
  const defaultName =
    !steps || template === "custom"
      ? ""
      : template === "alert"
        ? formatAlertLabel(steps[0])
        : `${steps[0].stock} buy as price rises (+${stepUp.percent}% × ${steps.length})`;
  const canSave = steps !== null && (name.trim() !== "" || defaultName !== "");

  // "Use current price": fills the ladder's start price with the stock's live price.
  function fillCurrentPrice() {
    return lookup.run(async () => {
      const current = await getStockPrice(stepUp.stock);
      if (current == null) throw new Error(`No price found for ${stepUp.stock.trim().toUpperCase()}`);
      setStepUp((draft) => ({ ...draft, startPrice: String(current) }));
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
    template,
    setTemplate,
    name,
    setName,
    defaultName,
    description,
    setDescription,
    condition,
    setCondition,
    stepUp,
    setStepUp,
    steps,
    canSave,
    create,
    save,
    lookup,
    fillCurrentPrice,
  };
}
