"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { removeAlert, updateAlert, type Alert, type Playbook } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice, type AlertOperator } from "@/lib/stockUtils";
import { ActiveSwitch, OperatorField, PriceField } from "./AlertFields";

const NO_PLAYBOOK = "";

export default function AlertDetailForm({
  alert,
  playbooks = [],
  onClose,
}: {
  alert: Alert;
  playbooks?: Playbook[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const [operator, setOperator] = useState<AlertOperator>(alert.operator);
  const [price, setPrice] = useState(String(alert.price));
  const [isActive, setIsActive] = useState(alert.isActive);
  const [description, setDescription] = useState(alert.description ?? "");
  const [playbookId, setPlaybookId] = useState(
    alert.playbook_id != null ? String(alert.playbook_id) : NO_PLAYBOOK,
  );
  const save = useAsyncAction();
  const remove = useAsyncAction();

  const priceValue = parsePrice(price);
  const busy = save.pending || remove.pending;

  function close() {
    if (onClose) {
      onClose();
    } else {
      router.push("/");
    }
  }

  // Runs a save/delete; on success refreshes the page data and closes the form.
  async function runAndClose(action: ReturnType<typeof useAsyncAction>, task: () => Promise<unknown>) {
    if (await action.run(task)) {
      router.refresh();
      close();
    }
  }

  function handleSave() {
    if (priceValue === null) return;
    return runAndClose(save, () =>
      updateAlert(alert.id, {
        stock: alert.stock,
        operator,
        price: priceValue,
        email: alert.email,
        isActive,
        description: description.trim() || null,
        playbook_id: playbookId === NO_PLAYBOOK ? null : Number(playbookId),
      }),
    );
  }

  const error = save.error ?? remove.error;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Alert #{alert.id} · created {new Date(alert.created_at).toLocaleString()}
      </Typography>
      <OperatorField value={operator} onChange={setOperator} />
      <PriceField value={price} onChange={setPrice} />
      <TextField
        label="Description"
        size="small"
        fullWidth
        multiline
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <TextField
        label="Playbook"
        size="small"
        select
        fullWidth
        value={playbookId}
        onChange={(e) => setPlaybookId(e.target.value)}
      >
        <MenuItem value={NO_PLAYBOOK}>No playbook</MenuItem>
        {playbooks.map((playbook) => (
          <MenuItem key={playbook.id} value={String(playbook.id)}>
            {playbook.name}
          </MenuItem>
        ))}
      </TextField>
      <ActiveSwitch checked={isActive} onChange={setIsActive} />
      {error && <Typography color="error">{error}</Typography>}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleSave} disabled={priceValue === null || busy}>
          {save.pending ? "Saving..." : "Save"}
        </Button>
        <Button color="error" onClick={() => runAndClose(remove, () => removeAlert(alert.id))} disabled={busy}>
          {remove.pending ? "Deleting..." : "Delete"}
        </Button>
        <Button onClick={close} disabled={busy}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
