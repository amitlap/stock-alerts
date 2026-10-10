"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowClassNameParams,
} from "@mui/x-data-grid";
import AlertDetailForm from "./AlertDetailForm";
import { getAlertById, getLatestStockPrices, removeAlert, type Alert } from "@/lib/actions";
import { getMatchingAlerts, type AlertOperator, type StockPrice } from "@/lib/stockUtils";

type AlertListItem = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
};

export default function AlertsList({ alerts }: { alerts: AlertListItem[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState<string | null>(null);

  useEffect(() => {
    const symbols = [...new Set(alerts.map((alert) => alert.stock))];
    if (symbols.length === 0) return;

    let cancelled = false;
    setPricesLoading(true);
    setPricesError(null);

    getLatestStockPrices(symbols)
      .then((prices) => {
        if (cancelled) return;
        setStocks(prices);
      })
      .catch((error) => {
        if (cancelled) return;
        setPricesError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (cancelled) return;
        setPricesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [alerts]);

  const matchingAlerts = useMemo(
    () => new Set(getMatchingAlerts(alerts, stocks)),
    [alerts, stocks],
  );

  useEffect(() => {
    if (editingId == null) return;

    let cancelled = false;
    setEditingAlert(null);
    setEditingLoading(true);
    setEditingError(null);

    getAlertById(editingId)
      .then((alert) => {
        if (cancelled) return;
        setEditingAlert(alert);
      })
      .catch((error) => {
        if (cancelled) return;
        setEditingError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (cancelled) return;
        setEditingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await removeAlert(id);
    } finally {
      setDeletingId(null);
    }
  }

  function openEditDialog(id: number) {
    setEditingId(id);
  }

  function closeEditDialog() {
    setEditingId(null);
    setEditingAlert(null);
    setEditingError(null);
  }

  const columns: GridColDef<AlertListItem>[] = [
    { field: "stock", headerName: "Stock", flex: 1 },
    {
      field: "condition",
      headerName: "Condition",
      flex: 1,
      valueGetter: (_value, row) => `${row.operator ?? ">"} ${row.price ?? "?"}`,
    },
    { field: "email", headerName: "Email", flex: 1.5 },
    { field: "isActive", headerName: "Active", type: "boolean", flex: 0.75 },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 1.5,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openEditDialog(params.row.id);
            }}
          >
            Edit
          </Button>
          <Button
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row.id);
            }}
            disabled={deletingId === params.row.id}
          >
            {deletingId === params.row.id ? "Deleting..." : "Delete"}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <>
      {pricesError && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          Failed to load stock prices: {pricesError}
        </Typography>
      )}
      <DataGrid
        autoHeight
        rows={alerts}
        columns={columns}
        loading={pricesLoading}
        density="compact"
        disableRowSelectionOnClick
        onRowClick={(params) => router.push(`/alerts/${params.row.id}`)}
        getRowClassName={(params: GridRowClassNameParams<AlertListItem>) =>
          matchingAlerts.has(params.row) ? "matching-row" : ""
        }
        sx={{
          "& .matching-row": {
            bgcolor: "grey.200",
          },
          "& .MuiDataGrid-row": { cursor: "pointer" },
        }}
      />
      <Drawer anchor="right" open={editingId !== null} onClose={closeEditDialog}>
        <Box sx={{ width: 420, display: "flex", flexDirection: "column", height: "100%" }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 2 }}>
            <Typography variant="h6">Edit Alert</Typography>
            <IconButton size="small" onClick={closeEditDialog} aria-label="Close">
              ✕
            </IconButton>
          </Stack>
          <Divider />
          <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            {editingLoading && <Typography variant="body2">Loading...</Typography>}
            {editingError && <Typography color="error">{editingError}</Typography>}
            {editingAlert && !editingLoading && (
              <AlertDetailForm alert={editingAlert} onClose={closeEditDialog} />
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
