"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AlertDetailForm from "./AlertDetailForm";
import RowActionButton from "./RowActionButton";
import SideDrawer from "./SideDrawer";
import { alertColumns, clickableRowsSx } from "./alertGrid";
import { getAlertById, getLatestStockPrices, removeAlert, type Playbook } from "@/lib/actions";
import { useAsyncData, usePendingId } from "@/lib/hooks";
import { getMatchingAlerts, type AlertRow } from "@/lib/stockUtils";

export default function AlertsList({
  alerts,
  playbooks = [],
}: {
  alerts: AlertRow[];
  playbooks?: Playbook[];
}) {
  const router = useRouter();
  const deleting = usePendingId();
  const [editingId, setEditingId] = useState<number | null>(null);

  const symbols = useMemo(() => [...new Set(alerts.map((alert) => alert.stock))], [alerts]);
  const prices = useAsyncData(symbols.length > 0 ? symbols : null, getLatestStockPrices);
  const editing = useAsyncData(editingId, getAlertById);

  const matchingAlerts = useMemo(
    () => new Set(getMatchingAlerts(alerts, prices.data ?? [])),
    [alerts, prices.data],
  );

  const columns: GridColDef<AlertRow>[] = [
    ...alertColumns,
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 1.5,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <RowActionButton onClick={() => setEditingId(row.id)}>Edit</RowActionButton>
          <RowActionButton
            color="error"
            onClick={() => deleting.run(row.id, () => removeAlert(row.id))}
            pending={deleting.pendingId === row.id}
            pendingLabel="Deleting..."
          >
            Delete
          </RowActionButton>
        </Stack>
      ),
    },
  ];

  const closeEditor = () => setEditingId(null);

  return (
    <>
      {prices.error && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          Failed to load stock prices: {prices.error}
        </Typography>
      )}
      <DataGrid
        autoHeight
        rows={alerts}
        columns={columns}
        loading={prices.loading}
        density="compact"
        disableRowSelectionOnClick
        onRowClick={(params) => router.push(`/alerts/${params.row.id}`)}
        getRowClassName={(params) => (matchingAlerts.has(params.row) ? "matching-row" : "")}
        sx={{ "& .matching-row": { bgcolor: "grey.200" }, ...clickableRowsSx }}
      />
      <SideDrawer open={editingId !== null} title="Edit Alert" onClose={closeEditor}>
        {editing.loading && <Typography variant="body2">Loading...</Typography>}
        {editing.error && <Typography color="error">{editing.error}</Typography>}
        {editing.data && !editing.loading && (
          <AlertDetailForm alert={editing.data} playbooks={playbooks} onClose={closeEditor} />
        )}
      </SideDrawer>
    </>
  );
}
