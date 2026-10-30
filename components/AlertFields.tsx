"use client";

import { FormControlLabel, MenuItem, Stack, Switch, TextField } from "@mui/material";
import { ALERT_OPERATORS, type AlertOperator } from "@/lib/stockUtils";

export type ConditionDraft = { stock: string; operator: AlertOperator; price: string };

export const EMPTY_CONDITION: ConditionDraft = { stock: "", operator: ">", price: "" };

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

// Stock, operator and price on one row: "AAPL  >  200".
export function ConditionFields({
  value,
  onChange,
}: {
  value: ConditionDraft;
  onChange: (value: ConditionDraft) => void;
}) {
  return (
    <Stack direction="row" spacing={1.5}>
      <TextField
        label="Stock"
        size="small"
        fullWidth
        value={value.stock}
        onChange={(e) => onChange({ ...value, stock: e.target.value })}
      />
      <OperatorField value={value.operator} onChange={(operator) => onChange({ ...value, operator })} />
      <PriceField value={value.price} onChange={(price) => onChange({ ...value, price })} />
    </Stack>
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
