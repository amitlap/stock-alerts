"use client";

import { useState } from "react";
import { Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { addAlert } from "./actions";
import type { AlertOperator } from "./stockUtils";

const OPERATORS: AlertOperator[] = ["=", ">", "<"];

export default function AddAlertForm() {
  const [stock, setStock] = useState("");
  const [operator, setOperator] = useState<AlertOperator>("=");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = Number(price);
  const canSave = stock.trim() !== "" && email.trim() !== "" && price.trim() !== "" && Number.isFinite(priceValue);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await addAlert({ stock: stock.trim().toUpperCase(), operator, price: priceValue, email: email.trim() });
      setStock("");
      setOperator("=");
      setPrice("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Typography variant="h6" component="h2">
        Add Alert
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Stock"
          size="small"
          fullWidth
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
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
        <Button variant="contained" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </Stack>
      {error && <Typography color="error">{error}</Typography>}
    </Stack>
  );
}
