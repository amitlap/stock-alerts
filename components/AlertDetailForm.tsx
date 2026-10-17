"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { removeAlert, updateAlert, type Alert, type Playbook } from "@/lib/actions";
import type { AlertOperator } from "@/lib/stockUtils";

const OPERATORS: AlertOperator[] = [">", "<"];
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = Number(price);
  const canSave = price.trim() !== "" && Number.isFinite(priceValue);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateAlert(alert.id, {
        stock: alert.stock,
        operator,
        price: priceValue,
        email: alert.email,
        isActive,
        description: description.trim() || null,
        playbook_id: playbookId === NO_PLAYBOOK ? null : Number(playbookId),
      });
      router.refresh();
      if (onClose) {
        onClose();
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await removeAlert(alert.id);
      router.refresh();
      if (onClose) {
        onClose();
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Alert #{alert.id} · created {new Date(alert.created_at).toLocaleString()}
      </Typography>
      <TextField
        label="Operator"
        size="small"
        select
        fullWidth
        value={operator}
        onChange={(e) => setOperator(e.target.value as AlertOperator)}
      >
        {OPERATORS.map((op) => (
          <MenuItem key={op} value={op}>
            {op}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Price"
        size="small"
        type="number"
        fullWidth
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
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
      <FormControlLabel
        control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
        label="Active"
      />
      {error && <Typography color="error">{error}</Typography>}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleSave} disabled={!canSave || saving || deleting}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button color="error" onClick={handleDelete} disabled={saving || deleting}>
          {deleting ? "Deleting..." : "Delete"}
        </Button>
        <Button onClick={() => (onClose ? onClose() : router.push("/"))} disabled={saving || deleting}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
