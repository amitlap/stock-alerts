import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getLatestStockPrices } from "@/lib/actions";
import {
  formatAlertCondition,
  formatAlertLabel,
  getErrorMessage,
  getMatchingAlerts,
} from "@/lib/stockUtils";
import { TICKERS } from "@/lib/constants";
import { createAdminClient } from "@/utils/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function GET(request: Request) {
  // Verify that the request comes from our GitHub Action
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return respond();
}

export async function POST(request: Request) {
  return respond();
}

async function respond() {
  try {
    const { matchingAlerts, alertEmails } = await checkStocks();

    return NextResponse.json({
      success: true,
      matchingAlerts,
      alertEmails,
    });
  } catch (error) {
    console.error("Stock check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

async function checkStocks() {
  console.log("Checking stocks...");

  const emailKey = process.env.RESEND_API_KEY;
  const emailFrom = 'alerts@stock-alerts-alpha.com';

  if (!emailKey) {
    throw new Error("RESEND_API_KEY must be configured");
  }

  const stocks = await getLatestStockPrices(TICKERS);

  // This route is called by a GitHub Action with no user session, so it needs the
  // service-role client to bypass RLS; otherwise the deactivation UPDATE below would
  // silently match 0 rows and alerts would keep re-firing on every run.
  const supabase = createAdminClient();
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("id, stock, email, price, operator, isActive");

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const matchingAlerts = getMatchingAlerts(alerts ?? [], stocks);
  console.log(
    "Stocks fulfilling alert conditions:",
    matchingAlerts.map(formatAlertLabel),
  );

  const alertEmails = await sendAlertEmails(matchingAlerts, stocks, emailKey, emailFrom);
  const sentAlertIds = await deactivateSentAlerts(alertEmails, supabase);
  await activateTargetAlerts(sentAlertIds, supabase);

  console.log("Stock check completed!");

  return { matchingAlerts, alertEmails };
}

// Sends one email per alert address, listing the stocks whose condition it matched.
async function sendAlertEmails(
  matchingAlerts: Awaited<ReturnType<typeof getMatchingAlerts>>,
  stocks: Awaited<ReturnType<typeof getLatestStockPrices>>,
  emailKey: string,
  emailFrom: string,
) {
  const alertsByEmail = new Map<string, typeof matchingAlerts>();
  for (const alert of matchingAlerts) {
    alertsByEmail.set(alert.email, [...(alertsByEmail.get(alert.email) ?? []), alert]);
  }

  const resend = new Resend(emailKey);
  const results = [];

  for (const [email, alertsForEmail] of alertsByEmail) {
    const rows = alertsForEmail
      .map((alert) => {
        const stock = stocks.find((s) => s.symbol === alert.stock);
        return `<tr><td>${alert.stock}</td><td>${formatAlertCondition(alert)}</td><td>$${stock?.price?.toFixed(2) ?? "N/A"}</td></tr>`;
      })
      .join("");

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: "Your stock alert was triggered",
      html: `<h1>Stock alert triggered</h1><table><thead><tr><th>Symbol</th><th>Condition</th><th>Current price</th></tr></thead><tbody>${rows}</tbody></table>`,
    });

    if (error) {
      console.error(`Failed to send alert email to ${email}:`, error.message);
    }

    results.push({ email, alerts: alertsForEmail, data, error: error?.message ?? null });
  }

  return results;
}

// Deactivates alerts once their email has gone out, so they only fire once until re-enabled by the user.
async function deactivateSentAlerts(
  alertEmails: Awaited<ReturnType<typeof sendAlertEmails>>,
  supabase: AdminClient,
) {
  const sentAlertIds = alertEmails
    .filter((result) => !result.error)
    .flatMap((result) => result.alerts)
    .map((alert) => alert.id)
    .filter((id): id is number => id != null);

  const deactivated = await setAlertsActive(supabase, sentAlertIds, false);
  return deactivated ? sentAlertIds : [];
}

// Activates the playbook's next alerts: every target of a transition whose source alert just fired.
// Alerts that fired in this same run are skipped so they don't get re-enabled and fire twice.
async function activateTargetAlerts(
  sentAlertIds: number[],
  supabase: AdminClient,
) {
  if (sentAlertIds.length === 0) return;

  const { data: transitions, error: transitionsError } = await supabase
    .from("alert_transitions")
    .select("target_alert_id")
    .in("source_alert_id", sentAlertIds);

  if (transitionsError) {
    console.error("Failed to load alert transitions:", transitionsError.message);
    return;
  }

  const targetIds = [...new Set((transitions ?? []).map((t) => t.target_alert_id as number))].filter(
    (id) => !sentAlertIds.includes(id),
  );

  if (await setAlertsActive(supabase, targetIds, true)) {
    console.log("Activated target alerts:", targetIds);
  }
}

// Sets isActive on the given alerts; returns false when there was nothing to update or the update failed.
async function setAlertsActive(supabase: AdminClient, ids: number[], isActive: boolean) {
  if (ids.length === 0) return false;

  const { error } = await supabase.from("alerts").update({ isActive }).in("id", ids);

  if (error) {
    console.error(`Failed to set isActive=${isActive} on alerts:`, error.message);
    return false;
  }

  return true;
}

