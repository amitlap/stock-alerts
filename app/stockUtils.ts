export type StockPrice = {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
};

export function isBigChange(stock: StockPrice) {
  if (!stock) return false;
  if (stock.symbol !== "NVDA") return false;

  return (stock.change ?? 0) > 2 || (stock.price ?? 0) > 233;
}
