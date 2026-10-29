"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";

// Mounts one of TradingView's embeddable widgets (e.g. "advanced-chart", "symbol-info") with the given config.
function TradingViewEmbed({
  widget,
  config,
  widgetStyle = "",
  style,
}: {
  widget: string;
  config: Record<string, unknown>;
  widgetStyle?: string;
  style?: CSSProperties;
}) {
  const container = useRef<HTMLDivElement>(null);
  const configJson = JSON.stringify(config);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    el.innerHTML = `<div class="tradingview-widget-container__widget" style="${widgetStyle}"></div>`;

    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = configJson;
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [widget, configJson, widgetStyle]);

  return <div className="tradingview-widget-container" ref={container} style={{ width: "100%", ...style }} />;
}

export default memo(TradingViewEmbed);
