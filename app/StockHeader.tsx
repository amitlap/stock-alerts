"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { getStockPrices } from "./actions";
import { TICKERS } from "./constants";

type StockPrice = Awaited<ReturnType<typeof getStockPrices>>[number];

export default function StockHeader() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStocks(await getStockPrices(TICKERS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(refresh, 0);

    return () => window.clearTimeout(initialRefreshId);
  }, [refresh]);

  async function handleCheckStocks() {
    setChecking(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/cron/stocks");
      const data = await res.json();
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
            onClick={handleCheckStocks}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check Stocks"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>
      </Stack>
      {emailResult && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {emailResult}
        </Typography>
      )}
    </Paper>
  );
}
