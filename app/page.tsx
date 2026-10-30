import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Stack, Typography } from "@mui/material";
import StockHeader from "@/components/StockHeader";
import TradingViewWidget from "@/components/TradingViewWidget";
import TradingViewSymbolInfo from "@/components/TradingViewSymbolInfo";
import MarketValuationTable from "@/components/MarketValuationTable";
import PlaybooksList from "@/components/PlaybooksList";
import ButtonLink from "@/components/ButtonLink";
import { getLatestStockPrices, getPlaybooksWithSteps } from "@/lib/actions";
import { getErrorMessage, getMatchingAlerts, getPlaybookProgress } from "@/lib/stockUtils";
import { getMarketValuation } from "@/lib/marketValuation";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

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

  const steps = playbooks.flatMap((playbook) => playbook.alerts);
  const progress = getPlaybookProgress(steps);
  const runningCount = playbooks.filter((playbook) => getPlaybookProgress(playbook.alerts).watching > 0).length;

  // Show stocks the user's playbooks follow, so each user sees their own list.
  const tickers = [...new Set(steps.map((step) => step.stock))];
  const stocks = tickers.length > 0 ? await getLatestStockPrices(tickers) : [];
  const matchingCount = getMatchingAlerts(steps, stocks).length;

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
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <StockHeader userEmail={user?.email ?? null} tickers={tickers} />
      </div>
      <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 gap-4">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Playbooks
            </Typography>
            <Typography variant="h4">{playbooks.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {runningCount} running
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Triggered now
            </Typography>
            <Typography variant="h4" color={matchingCount > 0 ? "error.main" : undefined}>
              {matchingCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              watching steps at their price now
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Steps done
            </Typography>
            <Typography variant="h4">
              {progress.done}/{progress.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress.watching} watching · {progress.waiting} waiting
            </Typography>
          </Paper>
        </Stack>

        {tickers.length > 0 && (
          <Paper component="section" elevation={1} sx={{ p: 2, height: 500 }}>
            <TradingViewWidget ticker={tickers[0]} />
          </Paper>
        )}

        <Paper component="section" elevation={1} sx={{ p: 2 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            S&amp;P 500 Snapshot
          </Typography>
          <MarketValuationTable data={marketValuation} error={marketValuationError} />
        </Paper>

        <Paper component="section" elevation={1} sx={{ p: 2 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            S&amp;P 500 Chart
          </Typography>
          <TradingViewSymbolInfo symbol="SP:SPX" />
        </Paper>

        <Paper component="section" elevation={1} sx={{ p: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" component="h2">
              My Playbooks
            </Typography>
            <ButtonLink href="/playbooks" size="small">
              Manage playbooks
            </ButtonLink>
          </Stack>
          {playbooksError ? (
            <Typography color="error">Failed to load playbooks: {playbooksError}</Typography>
          ) : playbooks.length === 0 ? (
            <Typography color="text.secondary">No playbooks yet.</Typography>
          ) : (
            <PlaybooksList playbooks={playbooks.slice(0, 5)} />
          )}
        </Paper>
      </main>
    </div>
  );
}

