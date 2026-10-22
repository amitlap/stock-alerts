"use client";

import { memo, useEffect, useRef } from "react";

// Renders TradingView's "Symbol Info" widget, which surfaces price, daily
// change, P/E ratio, dividend yield, and 52-week range for a given symbol.
function TradingViewSymbolInfo({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    el.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      colorTheme: "light",
      isTransparent: false,
      locale: "en",
      width: "100%",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ width: "100%" }}
    />
  );
}

export default memo(TradingViewSymbolInfo);
