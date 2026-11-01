import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { sendEarningsReminders } from "@/lib/earnings";
import { getErrorMessage } from "@/lib/stockUtils";

// Daily run (Supabase Cron): emails each playbook about its stocks reporting earnings the next business day.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Links in the emails point back to wherever this was called (the deployed site).
    const stocks = await sendEarningsReminders(new URL(request.url).origin);
    return NextResponse.json({ success: true, stocks });
  } catch (error) {
    console.error("Earnings reminders failed:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
