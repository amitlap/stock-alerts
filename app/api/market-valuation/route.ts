import { NextResponse } from "next/server";
import { getMarketValuation } from "@/lib/marketValuation";

export async function GET() {
  if (!process.env.FMP_KEY) {
    return NextResponse.json({ error: "Missing FMP_KEY" }, { status: 500 });
  }

  try {
    const valuation = await getMarketValuation();

    return NextResponse.json({
      symbol: "^GSPC",
      quote: valuation,
    });
  } catch (error) {
    console.error("Failed to fetch S&P 500 market valuation data:", error);

    return NextResponse.json({ error: "Unable to fetch market data" }, { status: 502 });
  }
}
