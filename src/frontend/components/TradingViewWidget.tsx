"use client";

import { memo, useEffect, useRef } from "react";

// A TradingView indicator: a built-in study's id, with its inputs when the defaults don't fit. Always an
// object: the widget drops plain-string ids from a list that also has objects in it.
export type Study = { id: string; inputs?: Record<string, number> };

// The built-in studies the playbook charts use, at their default settings unless given a length (in bars,
// so weeks on a weekly chart).
export const STUDIES = {
  sma: (length: number): Study => ({ id: "MASimple@tv-basicstudies", inputs: { length } }),
  ema: (length: number): Study => ({ id: "MAExp@tv-basicstudies", inputs: { length } }),
  donchian: (length: number): Study => ({ id: "DONCH@tv-basicstudies", inputs: { length } }),
  rsi: { id: "RSI@tv-basicstudies" }, // 14
  macd: { id: "MACD@tv-basicstudies" }, // 12, 26, 9
  bollinger: { id: "BB@tv-basicstudies" }, // 20, 2 standard deviations
  atr: { id: "ATR@tv-basicstudies" }, // 14
  pivots: { id: "PivotPointsHighLow@tv-basicstudies" }, // swing highs and lows, labelled with their price
} satisfies Record<string, Study | ((length: number) => Study)>;

// TradingView's embeddable advanced chart for one symbol, optionally with indicators (`studies` must be
// a stable array, since a new one reloads the chart) and with the symbol locked to `ticker`.
function TradingViewWidget({
  ticker,
  studies,
  interval = "D",
  lockSymbol = false,
}: {
  ticker: string;
  studies?: Study[];
  interval?: "D" | "W";
  lockSymbol?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    // Injected on the next tick: when React mounts, cleans up and remounts (as it does in development),
    // the first mount never starts TradingView's script, which throws if its container is emptied mid-load.
    const timer = setTimeout(() => {
      el.innerHTML = `<div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>`;

      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        allow_symbol_change: !lockSymbol,
        calendar: false,
        details: false,
        hide_side_toolbar: true,
        hide_top_toolbar: false,
        hide_legend: false,
        hide_volume: false,
        hotlist: false,
        interval,
        locale: "en",
        save_image: true,
        style: "1",
        symbol: ticker,
        theme: "light",
        timezone: "Etc/UTC",
        backgroundColor: "#ffffff",
        gridColor: "rgba(46, 46, 46, 0.2)",
        watchlist: [],
        withdateranges: false,
        compareSymbols: [],
        support_host: "https://www.tradingview.com",
        studies: studies ?? [],
        autosize: true,
      });
      el.appendChild(script);
    }, 0);

    return () => {
      clearTimeout(timer);
      el.innerHTML = "";
    };
  }, [ticker, studies, interval, lockSymbol]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }} />
  );
}

export default memo(TradingViewWidget);
