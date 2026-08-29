"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { getStockPrices } from "./actions";
import { TICKERS } from "./constants";

type StockPrice = Awaited<ReturnType<typeof getStockPrices>>[number];

export default function StockHeader() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(false);

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
        <Button
          variant="outlined"
          size="small"
          onClick={refresh}
          disabled={loading}
          sx={{ ml: "auto" }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>
    </Paper>
  );
}
