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
import { removeAlert, updateAlert, type Alert } from "@/lib/actions";
import type { AlertOperator } from "@/lib/stockUtils";

const OPERATORS: AlertOperator[] = [">", "<"];

export default function AlertDetailForm({ alert }: { alert: Alert }) {
  const router = useRouter();
  const [stock, setStock] = useState(alert.stock);
  const [operator, setOperator] = useState<AlertOperator>(alert.operator);
  const [price, setPrice] = useState(String(alert.price));
  const [email, setEmail] = useState(alert.email);
  const [isActive, setIsActive] = useState(alert.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = Number(price);
  const canSave =
    stock.trim() !== "" && email.trim() !== "" && price.trim() !== "" && Number.isFinite(priceValue);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateAlert(alert.id, {
        stock: stock.trim().toUpperCase(),
        operator,
        price: priceValue,
        email: email.trim(),
        isActive,
      });
      router.push("/");
      router.refresh();
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
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Typography variant="body2" color="text.secondary">
        Alert #{alert.id} · created {new Date(alert.created_at).toLocaleString()}
      </Typography>
      <TextField label="Stock" size="small" fullWidth value={stock} onChange={(e) => setStock(e.target.value)} />
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
        label="Email"
        size="small"
        type="email"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
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
        <Button onClick={() => router.push("/")} disabled={saving || deleting}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
