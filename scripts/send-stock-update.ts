import { Resend } from "resend";
import YahooFinance from "yahoo-finance2";
import { TICKERS } from "../app/constants";

const emailKey = process.env.EMAIL_KEY;
const emailTo = process.env.STOCK_EMAIL_TO;
const emailFrom = process.env.STOCK_EMAIL_FROM ?? "onboarding@resend.dev";

if (!emailKey || !emailTo) {
  throw new Error("EMAIL_KEY and STOCK_EMAIL_TO must be configured");
}

const yahooFinance = new YahooFinance();
const stocks = await yahooFinance.quote(TICKERS);
const stockRows = stocks
  .map(
    (stock) =>
      `<tr><td>${stock.symbol}</td><td>$${stock.regularMarketPrice?.toFixed(2) ?? "N/A"}</td><td>${stock.regularMarketChangePercent?.toFixed(2) ?? "N/A"}%</td></tr>`,
  )
  .join("");

await new Resend(emailKey).emails.send({
  from: emailFrom,
  to: emailTo,
  subject: "Stock price update",
  html: `<h1>Stock price update</h1><table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th></tr></thead><tbody>${stockRows}</tbody></table>`,
});

console.log(`Sent stock price update for ${stocks.length} stocks.`);