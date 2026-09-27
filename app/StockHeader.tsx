"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { TICKERS } from "./constants";
import { getLatestStockPrices } from "./actions";
import type { Alert, StockPrice } from "./stockUtils";

export default function StockHeader() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [alertsResult, setAlertsResult] = useState<string | null>(null);

  async function handleCheckStocks() {
    setChecking(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/cron/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendAnyway: true }),
      });
      const data = await res.json();
      console.log("Stock check response:", data);
      if (!data.success) {
        throw new Error(data.error ?? "Stock check failed");
      }
      setEmailResult(`Email sent (id: ${data.email?.id ?? "unknown"})`);
    } catch (error) {
      setEmailResult(
        `Email failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setChecking(false);
    }
  }

  async function handleCheckAlerts() {
    setCheckingAlerts(true);
    setAlertsResult(null);
    try {
      const [stockPrices, res] = await Promise.all([
        getLatestStockPrices(TICKERS),
        fetch("/api/cron/stocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendAnyway: false }),
        }),
      ]);
      setStocks(stockPrices);
      const data = await res.json();
      console.log("Alerts check response:", data);
      if (!data.success) {
        throw new Error(data.error ?? "Alerts check failed");
      }
      const matchingAlerts: Alert[] = data.matchingAlerts ?? [];
      setAlertsResult(
        matchingAlerts.length === 0
          ? "No alerts match the current prices."
          : `Emailed: ${matchingAlerts.map((alert) => `${alert.stock} ${alert.operator ?? "="} ${alert.price} (${alert.email})`).join(", ")}`,
      );
    } catch (error) {
      setAlertsResult(
        `Alerts check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCheckingAlerts(false);
    }
  }

  return (
    <Paper elevation={1} sx={{ width: "100%", maxWidth: 600, p: 2, mb: 3 }}>
      <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {stocks.map((stock) => (
          <Stack key={stock.symbol} direction="row" spacing={0.5} sx={{ alignItems: "baseline" }}>
            <div>{stock.symbol}</div>
            <Typography sx={{ color: (stock.change ?? 0) >= 0 ? "success.main" : "error.main" }}>
              ${stock.price?.toFixed(2)}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              setLoading(true);
              try {
                setStocks(await getLatestStockPrices(TICKERS));
              } finally {
                setLoading(false);
              }
            }}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check Stocks"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleCheckStocks}
            disabled={checking}
          >
            {checking ? "Sending..." : "Send Email"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleCheckAlerts}
            disabled={checkingAlerts}
          >
            {checkingAlerts ? "Checking..." : "check current stocks"}
          </Button>
        </Stack>
      </Stack>
      {emailResult && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {emailResult}
        </Typography>
      )}
      {alertsResult && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {alertsResult}
        </Typography>
      )}
    </Paper>
  );
}
