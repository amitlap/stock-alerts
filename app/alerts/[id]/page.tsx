import { notFound } from "next/navigation";
import { Paper, Stack, Typography } from "@mui/material";
import { getAlertById, getLatestStockPrices } from "@/lib/actions";
import AlertDetailForm from "@/components/AlertDetailForm";
import TradingViewWidget from "@/components/TradingViewWidget";

export default async function AlertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = await getAlertById(Number(id));

  if (!alert) {
    notFound();
  }

  const [stock] = await getLatestStockPrices([alert.stock]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 2 }}>
            <Typography variant="h5" component="h1">
              {alert.stock}
            </Typography>
            {stock?.price != null && (
              <Typography
                variant="h6"
                sx={{ color: (stock.change ?? 0) >= 0 ? "success.main" : "error.main" }}
              >
                ${stock.price.toFixed(2)}
              </Typography>
            )}
          </Stack>
          <AlertDetailForm alert={alert} />
          <div style={{ height: 500, width: "100%", marginTop: 24 }}>
            <TradingViewWidget ticker={alert.stock} />
          </div>
        </Paper>
      </main>
    </div>
  );
}
