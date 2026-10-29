import type { GridColDef } from "@mui/x-data-grid";
import { formatAlertCondition, type AlertRow } from "@/lib/stockUtils";

// Columns shared by every alerts grid; callers append their own action columns.
export const alertColumns: GridColDef<AlertRow>[] = [
  { field: "stock", headerName: "Stock", flex: 1 },
  {
    field: "condition",
    headerName: "Condition",
    flex: 1,
    valueGetter: (_value, row) => formatAlertCondition(row),
  },
  { field: "email", headerName: "Email", flex: 1.5 },
  { field: "isActive", headerName: "Active", type: "boolean", flex: 0.75 },
];

export const clickableRowsSx = { "& .MuiDataGrid-row": { cursor: "pointer" } };
