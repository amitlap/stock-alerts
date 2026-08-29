import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getLatestStockPrices } from "../../../actions";
import { TICKERS } from "../../../constants";

export async function GET(request: Request) {
  // Verify that the request comes from our GitHub Action
  //const authorization = request.headers.get("authorization");

  //if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  //}

  try {
    await checkStocks();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Stock check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Stock check failed",
      },
      { status: 500 },
    );
  }
}

async function checkStocks() {
  console.log("Checking stocks...");

  const emailKey = process.env.EMAIL_KEY;
  const emailTo = process.env.STOCK_EMAIL_TO;
  const emailFrom = process.env.STOCK_EMAIL_FROM ?? "onboarding@resend.dev";

  if (!emailKey || !emailTo) {
    throw new Error("EMAIL_KEY and STOCK_EMAIL_TO must be configured");
  }

  const stocks = await getLatestStockPrices(TICKERS);
  const stockRows = stocks
    .map(
      (stock) =>
        `<tr><td>${stock.symbol}</td><td>$${stock.price?.toFixed(2) ?? "N/A"}</td><td>${stock.changePercent?.toFixed(2) ?? "N/A"}%</td></tr>`,
    )
    .join("");

  await new Resend(emailKey).emails.send({
    from: emailFrom,
    to: emailTo,
    subject: "Stock price update",
    html: `<h1>Stock price update</h1><table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th></tr></thead><tbody>${stockRows}</tbody></table>`,
  });

  console.log("Stock check completed");
}
