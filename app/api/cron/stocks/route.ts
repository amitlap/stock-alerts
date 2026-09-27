import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getLatestStockPrices } from "../../../actions";
import { getMatchingAlerts, isBigChange } from "../../../stockUtils";
import { TICKERS } from "../../../constants";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  // Verify that the request comes from our GitHub Action
  //const authorization = request.headers.get("authorization");

  //if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  //}

  return respond(false);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return respond(body?.sendAnyway === true);
}

async function respond(sendAnyway: boolean) {
  try {
    const { email, matchingAlerts, alertEmails } = await checkStocks(sendAnyway);

    return NextResponse.json({
      success: true,
      email,
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

async function checkStocks(sendAnyway: boolean) {
  console.log("Checking stocks...");

  const emailKey = process.env.RESEND_API_KEY;
  const emailTo = ['Zusagi70@gmail.com','amitlapid711@gmail.com'];
  const emailFrom = 'alerts@stock-alerts-alpha.com';

  if (!emailKey) {
    throw new Error("RESEND_API_KEY and STOCK_EMAIL_TO must be configured1");
  }

  const stocks = await getLatestStockPrices(TICKERS);
  const stockRows = stocks
    .map(
      (stock) =>
        `<tr><td>${stock.symbol}</td><td>$${stock.price?.toFixed(2) ?? "N/A"}</td><td>${stock.changePercent?.toFixed(2) ?? "N/A"}%</td></tr>`,
    )
    .join("");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("stock, email, price, operator");

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  const matchingAlerts = getMatchingAlerts(alerts ?? [], stocks);
  console.log(
    "Stocks fulfilling alert conditions:",
    matchingAlerts.map((alert) => `${alert.stock} ${alert.operator ?? "="} ${alert.price}`),
  );

  const alertEmails = await sendAlertEmails(matchingAlerts, stocks, emailKey, emailFrom);

  const nvdaStock = stocks.find(stock => stock.symbol === "NVDA") ?? null;

  if (!sendAnyway && (!nvdaStock || !isBigChange(nvdaStock))) {
    console.log("NVDA change not significant, skipping email.");
    return { email: null, matchingAlerts, alertEmails };
  }

  const { data, error } = await new Resend(emailKey).emails.send({
    from: emailFrom,
    to: emailTo,
    subject: "Stock price update",
    html: `<h1>Stock price update</h1><table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th></tr></thead><tbody>${stockRows}</tbody></table>`,
  });

  if (error) {
    throw new Error(error.message);
  }

  console.log("Stock check completed!");

  return { email: data, matchingAlerts, alertEmails };
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
        return `<tr><td>${alert.stock}</td><td>${alert.operator ?? "="} ${alert.price}</td><td>$${stock?.price?.toFixed(2) ?? "N/A"}</td></tr>`;
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

    results.push({ email, data, error: error?.message ?? null });
  }

  return results;
}

