"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowClassNameParams,
} from "@mui/x-data-grid";
import { getLatestStockPrices, removeAlert } from "./actions";
import { getMatchingAlerts, type AlertOperator, type StockPrice } from "./stockUtils";

type AlertListItem = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
};

export default function AlertsList({ alerts }: { alerts: AlertListItem[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

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

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await removeAlert(id);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: GridColDef<AlertListItem>[] = [
    { field: "stock", headerName: "Stock", flex: 1 },
    {
      field: "condition",
      headerName: "Condition",
      flex: 1,
      valueGetter: (_value, row) => `${row.operator ?? "="} ${row.price ?? "?"}`,
    },
    { field: "email", headerName: "Email", flex: 1.5 },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 1,
      renderCell: (params) => (
        <Button
          size="small"
          color="error"
          onClick={() => handleDelete(params.row.id)}
          disabled={deletingId === params.row.id}
        >
          {deletingId === params.row.id ? "Deleting..." : "Delete"}
        </Button>
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
        getRowClassName={(params: GridRowClassNameParams<AlertListItem>) =>
          matchingAlerts.has(params.row) ? "matching-row" : ""
        }
        sx={{
          "& .matching-row": {
            bgcolor: "grey.200",
          },
        }}
      />
    </>
  );
}
