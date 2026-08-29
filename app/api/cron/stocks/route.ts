import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getLatestStockPrices } from "../../../actions";
import { TICKERS } from "../../../constants";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const emailKey = process.env.EMAIL_KEY;
  const emailTo = process.env.STOCK_EMAIL_TO;

  if (!emailKey || !emailTo) {
    return new NextResponse("EMAIL_KEY and STOCK_EMAIL_TO must be configured", {
      status: 500,
    });
  }

  const stocks = await getLatestStockPrices(TICKERS);
  const stockRows = stocks
    .map(
      (stock) =>
        `<tr><td>${stock.symbol}</td><td>$${stock.price?.toFixed(2) ?? "N/A"}</td><td>${stock.changePercent?.toFixed(2) ?? "N/A"}%</td></tr>`,
    )
    .join("");

  await new Resend(emailKey).emails.send({
    from: process.env.STOCK_EMAIL_FROM ?? "onboarding@resend.dev",
    to: emailTo,
    subject: "Stock price update",
    html: `<h1>Stock price update</h1><table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th></tr></thead><tbody>${stockRows}</tbody></table>`,
  });

  return NextResponse.json({ stocks, refreshedAt: new Date().toISOString() });
}
