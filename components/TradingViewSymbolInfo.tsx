"use client";

import TradingViewEmbed from "./TradingViewEmbed";

// Renders TradingView's "Symbol Info" widget, which surfaces price, daily
// change, P/E ratio, dividend yield, and 52-week range for a given symbol.
export default function TradingViewSymbolInfo({ symbol }: { symbol: string }) {
  return (
    <TradingViewEmbed
      widget="symbol-info"
      config={{ symbol, colorTheme: "light", isTransparent: false, locale: "en", width: "100%" }}
    />
  );
}
