import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import MarketValuationTable from "@/frontend/components/MarketValuationTable";
import PlaybooksList from "@/frontend/components/PlaybooksList";
import RecentFires, { type RecentFireItem } from "@/frontend/components/RecentFires";
import RunCheckButton from "@/frontend/components/RunCheckButton";
import StatCard from "@/frontend/components/StatCard";
import TickerChart from "@/frontend/components/TickerChart";
import WatchingSteps, { type WatchingStepItem } from "@/frontend/components/WatchingSteps";
import ButtonLink from "@/frontend/components/ButtonLink";
import PageHeader from "@/frontend/components/PageHeader";
import { getPlaybooks } from "@/backend/data";
import { getLatestStockPrices } from "@/backend/prices";
import { formatTimeAgo, getErrorMessage } from "@/shared/format";
import { distanceToTrigger, formatAlertLabel, getPlaybookProgress, getStepStatus, NEAR_TRIGGER_PERCENT } from "@/shared/steps";
import { getMarketValuation } from "@/backend/fmp";
import { getValuationHistory } from "@/backend/shiller";
import type { PlaybookWithSteps, ValuationHistory } from "@/shared/types";
import ValuationChart from "@/frontend/components/ValuationChart";

export default async function Home() {
  // The signed-in user's playbooks, each with its steps.
  let playbooks: PlaybookWithSteps[] = [];
  let playbooksError: string | null = null;
  try {
    playbooks = await getPlaybooks();
  } catch (error) {
    playbooksError = getErrorMessage(error);
  }

  const steps = playbooks.flatMap((playbook) =>
    playbook.alerts.map((step) => ({ step, playbookId: playbook.id, playbookName: playbook.name })),
  );
  const progress = getPlaybookProgress(steps.map(({ step }) => step));
  const runningCount = playbooks.filter((playbook) => getPlaybookProgress(playbook.alerts).watching > 0).length;

  // Prices for every stock the user's playbooks follow.
  const tickers = [...new Set(steps.map(({ step }) => step.stock))];
  const stocks = await getLatestStockPrices(tickers);
  const quoteBySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));

  // Watching steps, closest to firing first.
  const watching: WatchingStepItem[] = steps
    .filter(({ step }) => getStepStatus(step) === "watching")
    .map(({ step, playbookId, playbookName }) => {
      const quote = quoteBySymbol.get(step.stock);
      return {
        id: step.id,
        stock: step.stock,
        operator: step.operator,
        price: step.price,
        playbookId,
        playbookName,
        currentPrice: quote?.price ?? null,
        change: quote?.change ?? null,
        distance: quote?.price != null ? distanceToTrigger(step, quote.price) : null,
      };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  const atTriggerCount = watching.filter((item) => item.distance === 0).length;
  const nearCount = watching.filter((item) => item.distance != null && item.distance <= NEAR_TRIGGER_PERCENT).length;

  const recentFires: RecentFireItem[] = steps
    .filter(({ step }) => step.triggered_at)
    .sort((a, b) => b.step.triggered_at!.localeCompare(a.step.triggered_at!))
    .slice(0, 6)
    .map(({ step, playbookId, playbookName }) => ({
      id: step.id,
      label: formatAlertLabel(step),
      playbookId,
      playbookName,
      firedAgo: formatTimeAgo(step.triggered_at!),
    }));

  // Chart stocks in the order their steps are closest to firing; stocks with nothing watching go last.
  const watchRank = (symbol: string) => {
    const index = watching.findIndex((item) => item.stock === symbol);
    return index === -1 ? Infinity : index;
  };
  const chartStocks = [...stocks].sort((a, b) => watchRank(a.symbol) - watchRank(b.symbol));

  // FMP's live S&P 500 quote, and Shiller's monthly P/E history, loaded side by side.
  const [valuationResult, historyResult] = await Promise.allSettled([getMarketValuation(), getValuationHistory()]);
  const marketValuation = valuationResult.status === "fulfilled" ? valuationResult.value : null;
  const marketValuationError =
    valuationResult.status === "rejected"
      ? "Unable to fetch market data."
      : !marketValuation
        ? "FMP_KEY is not configured."
        : undefined;
  let valuationHistory: ValuationHistory | null = null;
  if (historyResult.status === "fulfilled") {
    valuationHistory = historyResult.value;
  } else {
    console.error("Failed to load Shiller valuation history:", historyResult.reason);
  }

  return (
    <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 gap-3">
      {playbooksError && <Typography color="error">Failed to load playbooks: {playbooksError}</Typography>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <StatCard
          label="Running playbooks"
          value={
            <>
              {runningCount}
              <Typography component="span" variant="h6" color="text.secondary">
                {" "}
                / {playbooks.length}
              </Typography>
            </>
          }
          caption="have a step watching"
        />
        <StatCard label="Watching steps" value={watching.length} caption={`across ${tickers.length} ${tickers.length === 1 ? "stock" : "stocks"}`} />
        <StatCard
          label="Near trigger"
          value={nearCount}
          valueColor={atTriggerCount > 0 ? "error.main" : nearCount > 0 ? "warning.main" : undefined}
          caption={atTriggerCount > 0 ? `${atTriggerCount} at trigger now` : `within ${NEAR_TRIGGER_PERCENT}% of price`}
        />
        <StatCard
          label="Steps done"
          value={`${progress.done}/${progress.total}`}
          caption={`${progress.waiting} waiting to start`}
        >
          <LinearProgress
            variant="determinate"
            value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        </StatCard>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" } }}>
        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <PageHeader section title="Watching now">
            <RunCheckButton />
          </PageHeader>
          <WatchingSteps items={watching} />
        </Paper>
        <Paper component="section" elevation={1} sx={{ p: 2.5, minWidth: 0 }}>
          <PageHeader section title="Recent fires" />
          <RecentFires items={recentFires} />
        </Paper>
      </Box>

      <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
        <PageHeader section title="My Playbooks">
          <ButtonLink href="/playbooks" size="small">
            {playbooks.length === 0 ? "Create a playbook" : `View all (${playbooks.length})`}
          </ButtonLink>
        </PageHeader>
        {playbooks.length === 0 ? (
          <Typography color="text.secondary">No playbooks yet — create one on the Playbooks page.</Typography>
        ) : (
          <PlaybooksList playbooks={playbooks.slice(0, 5)} />
        )}
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" },
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {chartStocks.length > 0 && (
            <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
              <PageHeader section title="Chart" />
              <TickerChart stocks={chartStocks} />
            </Paper>
          )}
          <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
            <PageHeader section title="S&P 500 P/E (earnings multiple)" />
            {valuationHistory ? (
              <ValuationChart history={valuationHistory} />
            ) : (
              <Typography color="text.secondary">S&amp;P 500 P/E history is unavailable right now.</Typography>
            )}
          </Paper>
        </Stack>
        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <PageHeader section title="S&P 500 Snapshot" />
          <MarketValuationTable data={marketValuation} error={marketValuationError} history={valuationHistory} />
        </Paper>
      </Box>
    </main>
  );
}
