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
    .select("id, stock, email");
  console.log(alerts, error);

  console.log("ALERTS:", alerts);
  console.log("ERROR:", error);
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <StockHeader />
      <Paper component="main" elevation={1} sx={{ width: "100%", maxWidth: 400, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Stock Order
        </Typography>

        <Typography variant="h6" component="h2" gutterBottom>
          Alerts
        </Typography>
        <AddAlertForm />
        {error ? (
          <Typography color="error">Failed to load alerts: {error.message}</Typography>
        ) : (
          <AlertsList alerts={alerts ?? []} />
        )}
      </Paper>
    </div>
  );
}

