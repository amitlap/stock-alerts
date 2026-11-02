"use client";

import { memo, useEffect, useRef } from "react";

// TradingView's embeddable advanced chart for one symbol.
function TradingViewWidget({ ticker }: { ticker: string }) {
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
        allow_symbol_change: true,
        calendar: false,
        details: false,
        hide_side_toolbar: true,
        hide_top_toolbar: false,
        hide_legend: false,
        hide_volume: false,
        hotlist: false,
        interval: "D",
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
        studies: [],
        autosize: true,
      });
      el.appendChild(script);
    }, 0);

    return () => {
      clearTimeout(timer);
      el.innerHTML = "";
    };
  }, [ticker]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }} />
  );
}

export default memo(TradingViewWidget);
