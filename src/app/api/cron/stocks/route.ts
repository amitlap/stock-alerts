import { cronRoute } from "@/backend/cron";
import { runStockCheck } from "@/backend/jobs/stockCheck";

// Supabase Cron, every 5 minutes in market hours. The dashboard's "Run check now" uses the server action.
export const GET = cronRoute("Stock check", runStockCheck);
