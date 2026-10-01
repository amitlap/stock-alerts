import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getLatestStockPrices } from "../../../actions";
import { getMatchingAlerts } from "../../../stockUtils";
import { TICKERS } from "../../../constants";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

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
        error: error instanceof Error
          ? error.message
          : String(error),
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

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("id, stock, email, price, operator, isActive");

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const matchingAlerts = getMatchingAlerts(alerts ?? [], stocks);
  console.log(
    "Stocks fulfilling alert conditions:",
    matchingAlerts.map((alert) => `${alert.stock} ${alert.operator ?? ">"} ${alert.price}`),
  );

  const alertEmails = await sendAlertEmails(matchingAlerts, stocks, emailKey, emailFrom);
  await deactivateSentAlerts(alertEmails, supabase);

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
        return `<tr><td>${alert.stock}</td><td>${alert.operator ?? ">"} ${alert.price}</td><td>$${stock?.price?.toFixed(2) ?? "N/A"}</td></tr>`;
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
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const sentAlertIds = alertEmails
    .filter((result) => !result.error)
    .flatMap((result) => result.alerts)
    .map((alert) => alert.id)
    .filter((id): id is number => id != null);

  if (sentAlertIds.length === 0) return;

  const { error } = await supabase.from("alerts").update({ isActive: false }).in("id", sentAlertIds);

  if (error) {
    console.error("Failed to deactivate sent alerts:", error.message);
  }
}

