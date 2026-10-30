"use client";

import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { addAlert } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice } from "@/lib/stockUtils";
import { ActiveSwitch, ConditionFields, EMPTY_CONDITION } from "./AlertFields";
import FormDialog from "./FormDialog";

// Adds a step to a playbook. New steps start off (waiting) unless `defaultActive`,
// since a transition from an earlier step is what normally turns them on.
export default function AddAlertForm({
  playbookId,
  email,
  defaultActive = false,
  onCreated,
}: {
  playbookId: number;
  email: string;
  defaultActive?: boolean;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState(EMPTY_CONDITION);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(defaultActive);
  const save = useAsyncAction();

  const price = parsePrice(condition.price);
  const canSave = condition.stock.trim() !== "" && price !== null;

  function handleOpen() {
    setCondition(EMPTY_CONDITION);
    setDescription("");
    setIsActive(defaultActive);
    save.setError(null);
    setOpen(true);
  }

  async function handleSave() {
    if (price === null) return;
    const saved = await save.run(() =>
      addAlert({
        stock: condition.stock,
        operator: condition.operator,
        price,
        email,
        isActive,
        description,
        playbook_id: playbookId,
      }),
    );
    if (saved) {
      setOpen(false);
      onCreated?.();
    }
  }

  return (
    <>
      <Button variant="contained" size="small" onClick={handleOpen}>
        Add step
      </Button>
      <FormDialog
        open={open}
        title="Add step"
        onClose={() => setOpen(false)}
        onSave={handleSave}
        saving={save.pending}
        canSave={canSave}
        error={save.error}
        maxWidth="sm"
      >
        <ConditionFields value={condition} onChange={setCondition} />
        <TextField
          label="Note (optional)"
          size="small"
          fullWidth
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <ActiveSwitch checked={isActive} onChange={setIsActive} />
      </FormDialog>
    </>
  );
}
