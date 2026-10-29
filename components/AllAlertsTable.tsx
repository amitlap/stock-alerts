"use client";

import { useRouter } from "next/navigation";
import { DataGrid } from "@mui/x-data-grid";
import type { AlertRow } from "@/lib/stockUtils";
import { alertColumns, clickableRowsSx } from "./alertGrid";

export default function AllAlertsTable({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();

  return (
    <DataGrid
      rows={alerts}
      columns={alertColumns}
      density="compact"
      disableRowSelectionOnClick
      hideFooterSelectedRowCount
      onRowClick={(params) => router.push(`/alerts/${params.row.id}`)}
      sx={{ height: 400, overflow: "auto", ...clickableRowsSx }}
    />
  );
}
