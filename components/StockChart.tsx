"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, type MouseEventParams } from "lightweight-charts";
import type { Candle } from "@/lib/stockUtils";

export default function StockChart({
  data,
  onPriceClick,
}: {
  data: Candle[];
  onPriceClick?: (price: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onPriceClickRef = useRef(onPriceClick);

  useEffect(() => {
    onPriceClickRef.current = onPriceClick;
  }, [onPriceClick]);

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

    function handleClick(param: MouseEventParams) {
      if (!param.point) return;
      // Convert the clicked pixel position back to a price on this series' scale.
      const price = series.coordinateToPrice(param.point.y);
      if (price != null) {
        onPriceClickRef.current?.(price);
      }
    }
    chart.subscribeClick(handleClick);

    return () => {
      chart.unsubscribeClick(handleClick);
      chart.remove();
    };
  }, [data]);

  return <div ref={container} style={{ height: "100%", width: "100%" }} />;
}
