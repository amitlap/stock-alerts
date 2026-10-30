"use client";

import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import { addAlert, updateAlert, type Alert, type AlertTransition } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { getStepWithDescendants } from "@/lib/playbookFlow";
import { formatAlertLabel, parsePrice } from "@/lib/stockUtils";
import { ActiveSwitch, ConditionFields, stepMenuItems, type ConditionDraft } from "./AlertFields";
import FormDialog from "./FormDialog";

// Not "", which MUI's select would show as empty instead of this option's label.
const START_ON_ITS_OWN = "none";

export type StepDialogTarget =
  | { mode: "add"; sourceStepId: number | null }
  | { mode: "edit"; step: Alert };

// The one place a playbook's steps are added and edited: the step's condition, note and Active flag,
// plus which step it starts after (its incoming transition) and why.
export default function StepDialog({
  target,
  playbookId,
  email,
  steps,
  transitions,
  onClose,
  onSaved,
}: {
  target: StepDialogTarget;
  playbookId: number;
  email: string;
  steps: Alert[];
  transitions: AlertTransition[];
  onClose: () => void;
  onSaved: (step: Alert) => void;
}) {
  const editing = target.mode === "edit" ? target.step : null;
  const incoming = editing ? transitions.find((t) => t.target_alert_id === editing.id) : undefined;
  const initialSourceId = editing
    ? incoming?.source_alert_id ?? null
    : target.mode === "add"
      ? target.sourceStepId
      : null;

  const [condition, setCondition] = useState<ConditionDraft>(
    editing
      ? { stock: editing.stock, operator: editing.operator, price: String(editing.price) }
      : { stock: steps[0]?.stock ?? "", operator: ">", price: "" },
  );
  const [sourceId, setSourceId] = useState(initialSourceId != null ? String(initialSourceId) : START_ON_ITS_OWN);
  const [explanation, setExplanation] = useState(incoming?.explanation ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [isActive, setIsActive] = useState(editing ? editing.isActive : initialSourceId == null);
  const save = useAsyncAction();

  // A step can't start after itself or anything that comes after it.
  const excluded = editing ? getStepWithDescendants(editing.id, transitions) : new Set<number>();
  const sourceOptions = steps.filter((step) => !excluded.has(step.id));
  const source = sourceOptions.find((step) => String(step.id) === sourceId);
  const price = parsePrice(condition.price);
  const canSave = condition.stock.trim() !== "" && price !== null;

  // When adding, a step that follows another waits for it, and one that starts on its own watches now.
  function handleSourceChange(value: string) {
    setSourceId(value);
    if (!editing) setIsActive(value === START_ON_ITS_OWN);
  }

  async function handleSave() {
    if (price === null) return;
    const fields = {
      stock: condition.stock,
      operator: condition.operator,
      price,
      email,
      isActive,
      description,
      playbook_id: playbookId,
    };
    const after = source ? { sourceAlertId: source.id, explanation } : null;
    let saved: Alert | undefined;
    const ok = await save.run(async () => {
      saved = editing ? await updateAlert(editing.id, fields, after) : await addAlert(fields, after);
    });
    if (ok && saved) onSaved(saved);
  }

  return (
    <FormDialog
      open
      title={editing ? `Edit step · ${formatAlertLabel(editing)}` : "Add step"}
      onClose={onClose}
      onSave={handleSave}
      saving={save.pending}
      canSave={canSave}
      error={save.error}
      maxWidth="sm"
    >
      <ConditionFields value={condition} onChange={setCondition} />
      {sourceOptions.length > 0 && (
        <TextField
          label="Starts after"
          size="small"
          select
          fullWidth
          value={sourceId}
          onChange={(e) => handleSourceChange(e.target.value)}
          helperText={
            source
              ? `Waits until ${formatAlertLabel(source)} fires, then starts watching.`
              : "Not linked to another step — it runs on its own."
          }
        >
          <MenuItem value={START_ON_ITS_OWN}>Nothing — start on its own</MenuItem>
          {stepMenuItems(sourceOptions)}
        </TextField>
      )}
      {source && (
        <TextField
          label="Why this follows (optional)"
          placeholder="e.g. Add the second portion after +1%"
          size="small"
          fullWidth
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      )}
      <TextField
        label="Note (optional)"
        placeholder="e.g. Buy 10 shares"
        size="small"
        fullWidth
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <ActiveSwitch checked={isActive} onChange={setIsActive} />
    </FormDialog>
  );
}
