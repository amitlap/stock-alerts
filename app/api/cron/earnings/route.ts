import { cronRoute } from "@/lib/cron";
import { sendEarningsReminders } from "@/lib/jobs/earnings";

// Supabase Cron, daily: emails each playbook about its stocks reporting earnings the next business day.
export const GET = cronRoute("Earnings reminders", async (request) => ({
  stocks: await sendEarningsReminders(new URL(request.url).origin),
}));
