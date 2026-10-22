import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Stack, Typography } from "@mui/material";
import StockHeader from "@/components/StockHeader";
import TradingViewWidget from "@/components/TradingViewWidget";
import TradingViewSymbolInfo from "@/components/TradingViewSymbolInfo";
import MarketValuationTable from "@/components/MarketValuationTable";
import AllAlertsTable from "@/components/AllAlertsTable";
import PlaybooksList from "@/components/PlaybooksList";
import ButtonLink from "@/components/ButtonLink";
import { getLatestStockPrices } from "@/lib/actions";
import { getMatchingAlerts } from "@/lib/stockUtils";
import { getMarketValuation } from "@/lib/marketValuation";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only show alerts belonging to the signed-in user.
  const { data: alerts, error: alertsError } = user?.email
    ? await supabase
        .from("alerts")
        .select("id, created_at, stock, email, price, operator, isActive, description, playbook_id")
        .eq("email", user.email)
    : { data: [], error: null };

  // Playbooks belonging to the signed-in user.
  const { data: playbooks, error: playbooksError } = user?.email
    ? await supabase
        .from("playbooks")
        .select("id, created_at, name, description, email")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  // Show stocks the user has alerts for, so each user sees their own list.
  const tickers = [...new Set((alerts ?? []).map((alert) => alert.stock))];
  const stocks = tickers.length > 0 ? await getLatestStockPrices(tickers) : [];
  const matchingCount = getMatchingAlerts(alerts ?? [], stocks).length;
  const activeCount = (alerts ?? []).filter((alert) => alert.isActive !== false).length;

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
              Alerts
            </Typography>
            <Typography variant="h4">{alerts?.length ?? 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeCount} active
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
              alerts matching current price
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Playbooks
            </Typography>
            <Typography variant="h4">{playbooks?.length ?? 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              saved strategies
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

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Paper component="section" elevation={1} sx={{ p: 3, flex: 1 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" component="h2">
                My Alerts
              </Typography>
              <ButtonLink href="/alerts" size="small">
                Manage alerts
              </ButtonLink>
            </Stack>
            {alertsError ? (
              <Typography color="error">Failed to load alerts: {alertsError.message}</Typography>
            ) : (alerts ?? []).length === 0 ? (
              <Typography color="text.secondary">No alerts yet.</Typography>
            ) : (
              <AllAlertsTable alerts={(alerts ?? []).slice(0, 5)} />
            )}
          </Paper>

          <Paper component="section" elevation={1} sx={{ p: 3, flex: 1 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" component="h2">
                My Playbooks
              </Typography>
              <ButtonLink href="/playbooks" size="small">
                Manage playbooks
              </ButtonLink>
            </Stack>
            {playbooksError ? (
              <Typography color="error">Failed to load playbooks: {playbooksError.message}</Typography>
            ) : (playbooks ?? []).length === 0 ? (
              <Typography color="text.secondary">No playbooks yet.</Typography>
            ) : (
              <PlaybooksList playbooks={(playbooks ?? []).slice(0, 5)} />
            )}
          </Paper>
        </Stack>
      </main>
    </div>
  );
}

