"use client";

import { MenuItem, Stack, TextField } from "@mui/material";
import { ALERT_OPERATORS, type AlertOperator } from "@/shared/types";

export type ConditionDraft = { stock: string; operator: AlertOperator; price: string };

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
      <TextField
        label="Operator"
        size="small"
        select
        fullWidth
        value={value.operator}
        onChange={(e) => onChange({ ...value, operator: e.target.value as AlertOperator })}
      >
        {ALERT_OPERATORS.map((op) => (
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
        value={value.price}
        onChange={(e) => onChange({ ...value, price: e.target.value })}
      />
    </Stack>
  );
}
