import { cronRoute } from "@/lib/cron";
import { runStockCheck } from "@/lib/jobs/stockCheck";

// Supabase Cron, every 5 minutes in market hours. The dashboard's "Run check now" uses the server action.
export const GET = cronRoute("Stock check", runStockCheck);
