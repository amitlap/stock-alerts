import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import type { MarketValuation } from "@/lib/marketValuation";

const NOT_AVAILABLE = "Not available";

function formatPoints(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function MarketValuationTable({
  data,
  error,
}: {
  data: MarketValuation | null;
  error?: string;
}) {
  if (error || !data) {
    return (
      <Typography color="text.secondary">
        {error ?? "S&P 500 market data is unavailable right now."}
      </Typography>
    );
  }

  const earningsYield = data.trailingPE ? (100 / data.trailingPE).toFixed(2) + "%" : null;

  const rows: Array<{ metric: string; value: string; note?: string }> = [
    { metric: "S&P 500 index value", value: formatPoints(data.price) },
    {
      metric: "Daily change (%)",
      value: `${formatPoints(data.change)} (${formatPercent(data.changePercent)})`,
    },
    {
      metric: "Trailing P/E",
      value: data.trailingPE != null ? data.trailingPE.toFixed(2) : NOT_AVAILABLE,
      note: data.trailingPE == null ? "Not provided for indexes by FMP" : undefined,
    },
    {
      metric: "Forward P/E",
      value: NOT_AVAILABLE,
      note: "Not provided for indexes by FMP",
    },
    {
      metric: "CAPE / Shiller P/E",
      value: data.cape != null ? data.cape.toFixed(2) : NOT_AVAILABLE,
      note: data.cape == null ? "Pending Shiller historical dataset import" : undefined,
    },
    {
      metric: "Earnings yield",
      value: earningsYield ?? NOT_AVAILABLE,
      note: earningsYield == null ? "Requires trailing P/E" : undefined,
    },
    {
      metric: "Dividend yield",
      value: NOT_AVAILABLE,
      note: "Not provided for indexes by FMP",
    },
    {
      metric: "52-week high/low",
      value: `${formatPoints(data.fiftyTwoWeekHigh)} / ${formatPoints(data.fiftyTwoWeekLow)}`,
    },
  ];

  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.metric}>
              <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                {row.metric}
              </TableCell>
              <TableCell sx={{ fontWeight: 500 }}>{row.value}</TableCell>
              <TableCell sx={{ color: "text.disabled" }}>
                <Typography variant="caption">{row.note}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Source: Financial Modeling Prep, as of {new Date(data.asOf).toLocaleString()}.
      </Typography>
    </TableContainer>
  );
}
