export type StockPrice = {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
};

export type AlertOperator = "=" | ">" | "<";

export type Alert = {
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
};

export function isBigChange(stock: StockPrice) {
  if (!stock) return false;
  if (stock.symbol !== "NVDA") return false;

  return (stock.change ?? 0) > 2 || (stock.price ?? 0) > 233;
}

function meetsCondition(currentPrice: number, operator: AlertOperator, targetPrice: number) {
  switch (operator) {
    case "=":
      return currentPrice === targetPrice;
    case ">":
      return currentPrice > targetPrice;
    case "<":
      return currentPrice < targetPrice;
  }
}

// Alerts whose condition (=, >, <) against the target price is met by the stock's current live price.
export function getMatchingAlerts(alerts: Alert[], stocks: StockPrice[]): Alert[] {
  return alerts.filter((alert) => {
    const stock = stocks.find((s) => s.symbol === alert.stock);
    if (!stock || stock.price == null || alert.price == null) return false;

    return meetsCondition(stock.price, alert.operator ?? "=", alert.price);
  });
}
