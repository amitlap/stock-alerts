"use client";

import { FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import { ALERT_OPERATORS, type AlertOperator } from "@/lib/stockUtils";

export function OperatorField({
  value,
  onChange,
}: {
  value: AlertOperator;
  onChange: (operator: AlertOperator) => void;
}) {
  return (
    <TextField
      label="Operator"
      size="small"
      select
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value as AlertOperator)}
    >
      {ALERT_OPERATORS.map((op) => (
        <MenuItem key={op} value={op}>
          {op}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function PriceField({ value, onChange }: { value: string; onChange: (price: string) => void }) {
  return (
    <TextField
      label="Price"
      size="small"
      type="number"
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label="Active"
    />
  );
}
