import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Typography } from "@mui/material";
import StockHeader from "./StockHeader";
import AddAlertForm from "./AddAlertForm";
import AlertsList from "./AlertsList";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, stock, email, price, operator");
  console.log(alerts, error);

  console.log("ALERTS:", alerts);
  console.log("ERROR:", error);
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <StockHeader />
      </div>
      <main className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4, flex: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Alerts
          </Typography>
          {error ? (
            <Typography color="error">Failed to load alerts: {error.message}</Typography>
          ) : (
            <AlertsList alerts={alerts ?? []} />
          )}
        </Paper>
        <Paper component="section" elevation={1} sx={{ p: 4, flex: 1 }}>
          <AddAlertForm />
        </Paper>
      </main>
    </div>
  );
}

