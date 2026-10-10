"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AlertDetailForm from "@/components/AlertDetailForm";
import TradingViewWidget from "@/components/TradingViewWidget";
import type { Alert } from "@/lib/actions";
import type { StockPrice } from "@/lib/stockUtils";

export default function AlertPageView({
  alert,
  stock,
}: {
  alert: Alert;
  stock?: StockPrice;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isUp = (stock?.change ?? 0) >= 0;

  return (
    <>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", mt: 2, mb: 1 }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {alert.stock}
        </Typography>
        {stock?.price != null && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography variant="h5" sx={{ color: isUp ? "success.main" : "error.main" }}>
              ${stock.price.toFixed(2)}
            </Typography>
            {stock.changePercent != null && (
              <Typography variant="body1" sx={{ color: isUp ? "success.main" : "error.main" }}>
                {isUp ? "+" : ""}
                {stock.changePercent.toFixed(2)}%
              </Typography>
            )}
          </Stack>
        )}
        <Chip
          label={alert.isActive ? "Active" : "Inactive"}
          color={alert.isActive ? "success" : "default"}
          size="small"
        />
        <Chip label={`Alerts when price ${alert.operator} ${alert.price}`} variant="outlined" size="small" />
        <Chip label={alert.email} variant="outlined" size="small" />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </Stack>

      {alert.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {alert.description}
        </Typography>
      )}

      <Paper component="section" elevation={1} sx={{ p: 2, height: 600 }}>
        <TradingViewWidget ticker={alert.stock} />
      </Paper>

      <Drawer anchor="right" open={editOpen} onClose={() => setEditOpen(false)}>
        <Box sx={{ width: 420, display: "flex", flexDirection: "column", height: "100%" }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 2 }}>
            <Typography variant="h6">Edit Alert · {alert.stock}</Typography>
            <IconButton size="small" onClick={() => setEditOpen(false)} aria-label="Close">
              ✕
            </IconButton>
          </Stack>
          <Divider />
          <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <AlertDetailForm alert={alert} onClose={() => setEditOpen(false)} />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
