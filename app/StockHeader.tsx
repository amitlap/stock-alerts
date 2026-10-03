"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { TICKERS } from "./constants";
import { getLatestStockPrices } from "./actions";
import type { Alert, StockPrice } from "./stockUtils";

export default function StockHeader({ userEmail }: { userEmail: string | null }) {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [alertsResult, setAlertsResult] = useState<string | null>(null);
  const [alertsResultIsError, setAlertsResultIsError] = useState(false);

  const handleFetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      setStocks(await getLatestStockPrices(TICKERS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handleFetchStocks();
  }, [handleFetchStocks]);

  async function handleCheckAlerts() {
    setCheckingAlerts(true);
    setAlertsResult(null);
    setAlertsResultIsError(false);
    try {
      const [stockPrices, res] = await Promise.all([
        getLatestStockPrices(TICKERS),
        fetch("/api/cron/stocks", { method: "POST" }),
      ]);
      setStocks(stockPrices);
      const data = await res.json();
      console.log("Alerts check response:", data);
      if (res.status === 401) {
        throw new Error("Unauthorized: request was rejected by the server.");
      }
      if (!data.success) {
        throw new Error(data.error ?? "Alerts check failed");
      }
      const matchingAlerts: Alert[] = data.matchingAlerts ?? [];
      setAlertsResult(
        matchingAlerts.length === 0
          ? "No alerts match the current prices."
          : `Emailed: ${matchingAlerts.map((alert) => `${alert.stock} ${alert.operator ?? ">"} ${alert.price} (${alert.email})`).join(", ")}`,
      );
    } catch (error) {
      setAlertsResultIsError(true);
      setAlertsResult(
        `Alerts check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCheckingAlerts(false);
    }
  }

  return (
    <Paper elevation={1} sx={{ width: "100%", p: 2, mb: 3 }}>
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
            onClick={handleFetchStocks}
            disabled={loading}
          >
            {loading ? "Checking..." : "Check Stocks"}
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
      {alertsResult && (
        <Typography
          variant="body2"
          color={alertsResultIsError ? "error" : undefined}
          sx={{ mt: 1 }}
        >
          {alertsResult}
        </Typography>
      )}
    </Paper>
  );
}
