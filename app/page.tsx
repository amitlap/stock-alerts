import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Typography } from "@mui/material";
import UserHeader from "./UserHeader";
import StockHeader from "./StockHeader";
import AddAlertForm from "./AddAlertForm";
import AlertsList from "./AlertsList";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const alertsQuery = supabase
    .from("alerts")
    .select("id, stock, email, price, operator, isActive");

  // Only show alerts belonging to the signed-in user.
  const { data: alerts, error } = user?.email
    ? await alertsQuery.eq("email", user.email)
    : { data: [], error: null };
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <UserHeader userEmail={user?.email ?? null} />
        <StockHeader userEmail={user?.email ?? null} />
      </div>
      <main className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4, flex: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            My Alerts
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

