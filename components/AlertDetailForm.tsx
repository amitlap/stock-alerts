"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { removeAlert, updateAlert, type Alert } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice, type AlertOperator } from "@/lib/stockUtils";
import { ActiveSwitch, OperatorField, PriceField } from "./AlertFields";

// Edits one playbook step. Deleting it returns to the playbook, since the step's page is gone.
export default function AlertDetailForm({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const router = useRouter();
  const [operator, setOperator] = useState<AlertOperator>(alert.operator);
  const [price, setPrice] = useState(String(alert.price));
  const [isActive, setIsActive] = useState(alert.isActive);
  const [description, setDescription] = useState(alert.description ?? "");
  const save = useAsyncAction();
  const remove = useAsyncAction();

  const priceValue = parsePrice(price);
  const busy = save.pending || remove.pending;

  async function handleSave() {
    if (priceValue === null) return;
    const saved = await save.run(() =>
      updateAlert(alert.id, { ...alert, operator, price: priceValue, isActive, description }),
    );
    if (saved) {
      router.refresh();
      onClose();
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this step? Its transitions are deleted too.")) return;
    if (await remove.run(() => removeAlert(alert.id))) {
      router.push(`/playbooks/${alert.playbook_id}`);
    }
  }

  const error = save.error ?? remove.error;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Step #{alert.id} · created {new Date(alert.created_at).toLocaleString()}
        {alert.triggered_at && ` · last fired ${new Date(alert.triggered_at).toLocaleString()}`}
      </Typography>
      <OperatorField value={operator} onChange={setOperator} />
      <PriceField value={price} onChange={setPrice} />
      <TextField
        label="Note"
        size="small"
        fullWidth
        multiline
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <ActiveSwitch checked={isActive} onChange={setIsActive} />
      {error && <Typography color="error">{error}</Typography>}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleSave} disabled={priceValue === null || busy}>
          {save.pending ? "Saving..." : "Save"}
        </Button>
        <Button color="error" onClick={handleDelete} disabled={busy}>
          {remove.pending ? "Deleting..." : "Delete"}
        </Button>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
