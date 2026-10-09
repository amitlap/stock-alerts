"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { addAlert } from "@/lib/actions";
import type { AlertOperator } from "@/lib/stockUtils";

const OPERATORS: AlertOperator[] = [">", "<"];

export default function AddAlertForm() {
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState("");
  const [operator, setOperator] = useState<AlertOperator>(">");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = Number(price);
  const canSave = stock.trim() !== "" && email.trim() !== "" && price.trim() !== "" && Number.isFinite(priceValue);

  function resetForm() {
    setStock("");
    setOperator(">");
    setPrice("");
    setEmail("");
    setIsActive(true);
    setError(null);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await addAlert({ stock: stock.trim().toUpperCase(), operator, price: priceValue, email: email.trim(), isActive });
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="contained" onClick={handleOpen}>
        Add Alert
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Add Alert</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Active"
            />
            {error && <Typography color="error">{error}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
