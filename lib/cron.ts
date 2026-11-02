import "server-only";
import { NextResponse } from "next/server";
import { getErrorMessage } from "./format";

// Scheduled jobs (Supabase Cron) call our endpoints with the shared CRON_SECRET as a bearer token.
// An unset secret never matches, so a missing env var can't open the endpoint.
function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

// A GET route handler that checks the cron secret, runs `job` and replies with its result as JSON.
export function cronRoute(name: string, job: (request: Request) => Promise<object>) {
  return async function GET(request: Request) {
    if (!isCronRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      return NextResponse.json({ success: true, ...(await job(request)) });
    } catch (error) {
      console.error(`${name} failed:`, error);
      return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
    }
  };
}
