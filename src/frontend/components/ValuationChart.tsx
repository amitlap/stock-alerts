"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { createChart, LineSeries, LineStyle, PriceScaleMode, type IChartApi } from "lightweight-charts";
import type { ValuationHistory, ValuationPoint } from "@/shared/types";
import { formatMonthYear } from "@/shared/format";

const SERIES = [
  { key: "pe", label: "Trailing P/E", color: "#2563eb" },
  { key: "cape", label: "CAPE", color: "#d97706" },
] as const;

const RANGES = { "5Y": 5, "20Y": 20, All: null } as const;
type Range = keyof typeof RANGES;

function average(points: ValuationPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

// S&P 500 trailing P/E and CAPE over time, with dashed lines at each one's long-run average.
export default function ValuationChart({ history }: { history: ValuationHistory }) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<Range>("20Y");

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#333333" },
      grid: {
        vertLines: { color: "rgba(46, 46, 46, 0.06)" },
        horzLines: { color: "rgba(46, 46, 46, 0.1)" },
      },
      // Log scale, so spikes like 2009's P/E (~120, when earnings collapsed) don't flatten everything else.
      rightPriceScale: { borderVisible: false, mode: PriceScaleMode.Logarithmic },
      timeScale: { borderVisible: false },
      localization: { priceFormatter: (value: number) => value.toFixed(1) },
    });

    for (const { key, label, color } of SERIES) {
      const points = history[key];
      if (points.length === 0) continue;
      const series = chart.addSeries(LineSeries, { color, lineWidth: 2, title: label, priceLineVisible: false });
      series.setData(points);
      series.createPriceLine({
        price: average(points),
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "avg",
      });
    }

    chartRef.current = chart;
    return () => {
      chartRef.current = null;
      chart.remove();
    };
  }, [history]);

  // Show the chosen period, ending at the latest month in either series.
  useEffect(() => {
    const chart = chartRef.current;
    const last = [history.pe.at(-1)?.time, history.cape.at(-1)?.time].filter(Boolean).sort().at(-1);
    if (!chart || !last) return;

    // Wait a frame: the chart sizes itself after mount, and a range set before that is lost.
    const frame = requestAnimationFrame(() => {
      const years = RANGES[range];
      if (years === null) {
        chart.timeScale().fitContent();
      } else {
        const from = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`;
        chart.timeScale().setVisibleRange({ from, to: last });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [range, history]);

  return (
    <>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          {SERIES.map(({ key, label, color }) => {
            const latest = history[key].at(-1);
            return (
              latest && (
                <Typography key={key} variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component="span" sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: color }} />
                  {label} <strong>{latest.value.toFixed(1)}</strong>
                  <Typography component="span" variant="caption" color="text.secondary">
                    {formatMonthYear(latest.time)} · avg {average(history[key]).toFixed(1)}
                  </Typography>
                </Typography>
              )
            );
          })}
        </Stack>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_event, value: Range | null) => value && setRange(value)}
          aria-label="Time range"
        >
          {(Object.keys(RANGES) as Range[]).map((key) => (
            <ToggleButton key={key} value={key} sx={{ px: 1.25, py: 0.25 }}>
              {key}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Box ref={container} sx={{ height: 300 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Monthly data from Robert Shiller (shillerdata.com). Earnings are reported with a lag, so trailing P/E ends a few
        months before CAPE.
      </Typography>
    </>
  );
}
