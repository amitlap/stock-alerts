"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import AlertDetailForm from "@/components/AlertDetailForm";
import SideDrawer from "@/components/SideDrawer";
import StockChart from "@/components/StockChart";
import type { Alert, Playbook } from "@/lib/actions";
import { formatAlertCondition, priceChangeColor, type Candle, type StockPrice } from "@/lib/stockUtils";

export default function AlertPageView({
  alert,
  stock,
  candles,
  playbook,
  playbooks = [],
}: {
  alert: Alert;
  stock?: StockPrice;
  candles: Candle[];
  playbook?: Playbook | null;
  playbooks?: Playbook[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isUp = (stock?.change ?? 0) >= 0;
  const changeColor = priceChangeColor(stock?.change);

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
            <Typography variant="h5" sx={{ color: changeColor }}>
              ${stock.price.toFixed(2)}
            </Typography>
            {stock.changePercent != null && (
              <Typography variant="body1" sx={{ color: changeColor }}>
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
        <Chip label={`Alerts when price ${formatAlertCondition(alert)}`} variant="outlined" size="small" />
        <Chip label={alert.email} variant="outlined" size="small" />
        {playbook && (
          <Chip
            component={Link}
            href={`/playbooks/${playbook.id}`}
            clickable
            label={`Playbook: ${playbook.description || `#${playbook.id}`}`}
            color="primary"
            variant="outlined"
            size="small"
          />
        )}
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
        <StockChart
          data={candles}
          onPriceClick={(price) => console.log("Clicked price", alert.stock, price)}
        />
      </Paper>

      <SideDrawer open={editOpen} title={`Edit Alert · ${alert.stock}`} onClose={() => setEditOpen(false)}>
        <AlertDetailForm alert={alert} playbooks={playbooks} onClose={() => setEditOpen(false)} />
      </SideDrawer>
    </>
  );
}
