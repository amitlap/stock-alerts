"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart } from "lightweight-charts";
import type { Candle } from "@/lib/stockUtils";

export default function StockChart({ data }: { data: Candle[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#333333" },
      grid: {
        vertLines: { color: "rgba(46, 46, 46, 0.1)" },
        horzLines: { color: "rgba(46, 46, 46, 0.1)" },
      },
    });

    const series = chart.addSeries(CandlestickSeries);
    series.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data]);

  return <div ref={container} style={{ height: "100%", width: "100%" }} />;
}
