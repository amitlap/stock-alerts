"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  DataGrid,
  type GridColDef,
  type GridRowClassNameParams,
} from "@mui/x-data-grid";
import { getLatestStockPrices, removeAlert, updateAlert } from "./actions";
import { getMatchingAlerts, type AlertOperator, type StockPrice } from "./stockUtils";

const OPERATORS: AlertOperator[] = [">", "<"];

type AlertListItem = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
};

export default function AlertsList({ alerts }: { alerts: AlertListItem[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<AlertListItem | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editOperator, setEditOperator] = useState<AlertOperator>(">");
  const [editPrice, setEditPrice] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function openEditDialog(alert: AlertListItem) {
    setEditingAlert(alert);
    setEditStock(alert.stock);
    setEditOperator(alert.operator ?? ">");
    setEditPrice(alert.price != null ? String(alert.price) : "");
    setEditEmail(alert.email);
    setEditIsActive(alert.isActive ?? true);
    setEditError(null);
  }

  function closeEditDialog() {
    setEditingAlert(null);
  }

  const editPriceValue = Number(editPrice);
  const canSaveEdit =
    editStock.trim() !== "" &&
    editEmail.trim() !== "" &&
    editPrice.trim() !== "" &&
    Number.isFinite(editPriceValue);

  async function handleEditSave() {
    if (!editingAlert) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateAlert(editingAlert.id, {
        stock: editStock.trim().toUpperCase(),
        operator: editOperator,
        price: editPriceValue,
        email: editEmail.trim(),
        isActive: editIsActive,
      });
      setEditingAlert(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditSaving(false);
    }
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
          <Button size="small" onClick={() => openEditDialog(params.row)}>
            Edit
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
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
        getRowClassName={(params: GridRowClassNameParams<AlertListItem>) =>
          matchingAlerts.has(params.row) ? "matching-row" : ""
        }
        sx={{
          "& .matching-row": {
            bgcolor: "grey.200",
          },
        }}
      />
      <Dialog open={editingAlert !== null} onClose={closeEditDialog} fullWidth maxWidth="xs">
        <DialogTitle>Edit Alert</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Stock"
              size="small"
              fullWidth
              value={editStock}
              onChange={(e) => setEditStock(e.target.value)}
            />
            <TextField
              label="Operator"
              size="small"
              select
              fullWidth
              value={editOperator}
              onChange={(e) => setEditOperator(e.target.value as AlertOperator)}
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
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
            />
            <TextField
              label="Email"
              size="small"
              type="email"
              fullWidth
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
              }
              label="Active"
            />
            {editError && <Typography color="error">{editError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={!canSaveEdit || editSaving}>
            {editSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
