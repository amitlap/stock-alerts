"use client";

import TradingViewEmbed from "./TradingViewEmbed";

export default function TradingViewWidget({ ticker }: { ticker: string }) {
  return (
    <TradingViewEmbed
      widget="advanced-chart"
      widgetStyle="height:calc(100% - 32px);width:100%"
      style={{ height: "100%" }}
      config={{
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
      }}
    />
  );
}
