"use client";

import { useState } from "react";
import { Box, Chip, Stack } from "@mui/material";
import { priceChangeColor, type StockPrice } from "@/lib/stockUtils";
import TradingViewWidget from "./TradingViewWidget";

// A TradingView chart with a chip per followed stock (showing its price) to switch between them.
// Pass `symbol` to control which stock is shown; the chart only reloads when that stock changes.
export default function TickerChart({
  stocks,
  symbol: controlledSymbol,
  onSymbolChange,
  height = 460,
}: {
  stocks: StockPrice[];
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
  height?: number;
}) {
  const [ownSymbol, setOwnSymbol] = useState(stocks[0]?.symbol);
  const symbol = controlledSymbol ?? ownSymbol;

  function setSymbol(next: string) {
    setOwnSymbol(next);
    onSymbolChange?.(next);
  }

  if (!symbol) return null;

  return (
    <>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        {stocks.map((stock) => (
          <Chip
            key={stock.symbol}
            onClick={() => setSymbol(stock.symbol)}
            variant={stock.symbol === symbol ? "filled" : "outlined"}
            color={stock.symbol === symbol ? "primary" : "default"}
            label={
              <>
                {stock.symbol}{" "}
                <Box component="span" sx={{ color: stock.symbol === symbol ? "inherit" : priceChangeColor(stock.change) }}>
                  {stock.price != null ? `$${stock.price.toFixed(2)}` : ""}
                </Box>
              </>
            }
          />
        ))}
      </Stack>
      <Box sx={{ height }}>
        <TradingViewWidget ticker={symbol} />
      </Box>
    </>
  );
}
