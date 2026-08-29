"use client";

import { useState } from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getStockPrice, saveOrder } from "./actions";
import { TICKERS } from "./constants";
import StockHeader from "./StockHeader";

export default function Home() {
  const [ticker, setTicker] = useState(TICKERS[0]);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheckPrice() {
    setLoading(true);
    try {
      const price = await getStockPrice(ticker);
      setPrice(price);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <StockHeader />
      <Paper component="main" elevation={1} sx={{ width: "100%", maxWidth: 400, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Stock Order
        </Typography>
        <form action={saveOrder}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              select
              name="ticker"
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
            >
              {TICKERS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Button
                type="button"
                variant="outlined"
                onClick={handleCheckPrice}
                disabled={loading}
              >
                {loading ? "Loading..." : "Current Price"}
              </Button>
              {price !== null && <Typography>${price.toFixed(2)}</Typography>}
            </Stack>
            <TextField
              type="number"
              name="price"
              label="Price"
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
              required
            />
            <Button type="submit" variant="contained" size="large">
              Send
            </Button>
          </Stack>
        </form>
      </Paper>
    </div>
  );
}

