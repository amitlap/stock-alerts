"use client";

import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import type { AlertOperator } from "@/lib/stockUtils";

type ReadOnlyAlert = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
};

const columns: GridColDef<ReadOnlyAlert>[] = [
  { field: "stock", headerName: "Stock", flex: 1 },
  {
    field: "condition",
    headerName: "Condition",
    flex: 1,
    valueGetter: (_value, row) => `${row.operator ?? ">"} ${row.price ?? "?"}`,
  },
  { field: "email", headerName: "Email", flex: 1.5 },
  { field: "isActive", headerName: "Active", type: "boolean", flex: 0.75 },
];

export default function AllAlertsTable({ alerts }: { alerts: ReadOnlyAlert[] }) {
  return (
    <DataGrid
      rows={alerts}
      columns={columns}
      density="compact"
      disableRowSelectionOnClick
      hideFooterSelectedRowCount
      sx={{ height: 400, overflow: "auto" }}
    />
  );
}
