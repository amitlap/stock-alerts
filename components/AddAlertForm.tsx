"use client";

import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { addAlert } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice, type AlertOperator } from "@/lib/stockUtils";
import { ActiveSwitch, OperatorField, PriceField } from "./AlertFields";
import FormDialog from "./FormDialog";

export default function AddAlertForm({
  buttonLabel = "Add Alert",
  defaultEmail = "",
  playbookId = null,
  onCreated,
}: {
  buttonLabel?: string;
  defaultEmail?: string;
  playbookId?: number | null;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState("");
  const [operator, setOperator] = useState<AlertOperator>(">");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [isActive, setIsActive] = useState(true);
  const save = useAsyncAction();

  const priceValue = parsePrice(price);
  const canSave = stock.trim() !== "" && email.trim() !== "" && priceValue !== null;

  function handleOpen() {
    setStock("");
    setOperator(">");
    setPrice("");
    setEmail(defaultEmail);
    setIsActive(true);
    save.setError(null);
    setOpen(true);
  }

  async function handleSave() {
    if (priceValue === null) return;
    const saved = await save.run(() =>
      addAlert({
        stock: stock.trim().toUpperCase(),
        operator,
        price: priceValue,
        email: email.trim(),
        isActive,
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
      <Button variant="contained" onClick={handleOpen}>
        {buttonLabel}
      </Button>
      <FormDialog
        open={open}
        title="Add Alert"
        onClose={() => setOpen(false)}
        onSave={handleSave}
        saving={save.pending}
        canSave={canSave}
        error={save.error}
      >
        <TextField label="Stock" size="small" fullWidth value={stock} onChange={(e) => setStock(e.target.value)} />
        <OperatorField value={operator} onChange={setOperator} />
        <PriceField value={price} onChange={setPrice} />
        <TextField
          label="Email"
          size="small"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ActiveSwitch checked={isActive} onChange={setIsActive} />
      </FormDialog>
    </>
  );
}
