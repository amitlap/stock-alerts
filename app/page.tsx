import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import CreatePlaybookCard from "@/components/CreatePlaybookCard";
import MarketValuationTable from "@/components/MarketValuationTable";
import PlaybooksList from "@/components/PlaybooksList";
import RecentFires, { type RecentFireItem } from "@/components/RecentFires";
import RunCheckButton from "@/components/RunCheckButton";
import StatCard from "@/components/StatCard";
import TickerChart from "@/components/TickerChart";
import WatchingSteps, { type WatchingStepItem } from "@/components/WatchingSteps";
import ButtonLink from "@/components/ButtonLink";
import PageHeader from "@/components/PageHeader";
import { getLatestStockPrices, getPlaybooksWithSteps } from "@/lib/actions";
import {
  distanceToTrigger,
  formatAlertLabel,
  formatTimeAgo,
  getErrorMessage,
  getPlaybookProgress,
  getStepStatus,
  NEAR_TRIGGER_PERCENT,
} from "@/lib/stockUtils";
import { getMarketValuation } from "@/lib/marketValuation";

export default async function Home() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The signed-in user's playbooks, each with its steps.
  let playbooks: Awaited<ReturnType<typeof getPlaybooksWithSteps>> = [];
  let playbooksError: string | null = null;
  if (user?.email) {
    try {
      playbooks = await getPlaybooksWithSteps(user.email);
    } catch (error) {
      playbooksError = getErrorMessage(error);
    }
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

  let marketValuation = null;
  let marketValuationError: string | undefined;
  try {
    marketValuation = await getMarketValuation();
    if (!marketValuation) marketValuationError = "FMP_KEY is not configured.";
  } catch {
    marketValuationError = "Unable to fetch market data.";
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 gap-3">
        {user?.email && <CreatePlaybookCard userEmail={user.email} isFirst={playbooks.length === 0} />}

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
          <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
            <PageHeader section title="Recent fires" />
            <RecentFires items={recentFires} />
          </Paper>
        </Box>

        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <PageHeader section title="My Playbooks">
            <ButtonLink href="/playbooks" size="small">
              View all ({playbooks.length})
            </ButtonLink>
          </PageHeader>
          {playbooks.length === 0 ? (
            <Typography color="text.secondary">No playbooks yet — create one above.</Typography>
          ) : (
            <PlaybooksList playbooks={playbooks.slice(0, 5)} />
          )}
        </Paper>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" } }}>
          {chartStocks.length > 0 && (
            <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
              <PageHeader section title="Chart" />
              <TickerChart stocks={chartStocks} />
            </Paper>
          )}
          <Paper component="section" elevation={1} sx={{ p: 2.5, gridColumn: chartStocks.length > 0 ? undefined : "1 / -1" }}>
            <PageHeader section title="S&P 500 Snapshot" />
            <MarketValuationTable data={marketValuation} error={marketValuationError} />
          </Paper>
        </Box>
      </main>
    </div>
  );
}
