// S&P 500 valuation history (trailing P/E and CAPE) from Robert Shiller's monthly dataset.
// FMP has no index-level P/E on our plan, and TradingView's embeds don't offer one, so this is the source.
import * as XLSX from "xlsx";

export type ValuationPoint = { time: string; value: number }; // time: "YYYY-MM-01"

export type ValuationHistory = {
  pe: ValuationPoint[]; // price / trailing 12-month earnings; earnings lag a few months
  cape: ValuationPoint[]; // price / 10-year average real earnings
};

const SHILLER_PAGE = "https://shillerdata.com/";
const ONE_DAY_SECONDS = 24 * 60 * 60;

// Parsing the ~1.6 MB workbook is the slow part, so keep the result for a day per server instance.
let cached: { at: number; data: ValuationHistory } | null = null;

export async function getValuationHistory(): Promise<ValuationHistory> {
  if (cached && Date.now() - cached.at < ONE_DAY_SECONDS * 1000) return cached.data;

  const data = parseWorkbook(await downloadWorkbook());
  cached = { at: Date.now(), data };
  return data;
}

// The file's download link changes when it's updated, so read the current one from the page.
async function downloadWorkbook(): Promise<ArrayBuffer> {
  const page = await fetch(SHILLER_PAGE, { next: { revalidate: ONE_DAY_SECONDS } });
  if (!page.ok) throw new Error(`Shiller page request failed with status ${page.status}`);

  const href = (await page.text()).match(/href="([^"]*ie_data\.xls[^"]*)"/i)?.[1];
  if (!href) throw new Error("Couldn't find the Shiller data file link");

  // Too big for Next's data cache (2 MB limit), so it's fetched fresh; the parsed result is cached above.
  const file = await fetch(new URL(href, SHILLER_PAGE), { cache: "no-store" });
  if (!file.ok) throw new Error(`Shiller data download failed with status ${file.status}`);
  return file.arrayBuffer();
}

function parseWorkbook(buffer: ArrayBuffer): ValuationHistory {
  const sheet = XLSX.read(buffer, { type: "array" }).Sheets["Data"];
  if (!sheet) throw new Error("Shiller data sheet not found");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  // Columns are found by their header labels ("Date", "P", "E", "CAPE") rather than fixed positions.
  const headerIndex = rows.findIndex((row) => row[0] === "Date");
  const header = rows[headerIndex] ?? [];
  const priceCol = header.indexOf("P");
  const earningsCol = header.indexOf("E");
  const capeCol = header.indexOf("CAPE");
  if (headerIndex < 0 || priceCol < 0 || earningsCol < 0 || capeCol < 0) {
    throw new Error("Unexpected Shiller data layout");
  }

  const pe: ValuationPoint[] = [];
  const cape: ValuationPoint[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const time = toMonth(row[0]);
    if (!time) continue;

    const price = row[priceCol];
    const earnings = row[earningsCol];
    if (isPositive(price) && isPositive(earnings)) pe.push({ time, value: price / earnings });
    if (isPositive(row[capeCol])) cape.push({ time, value: row[capeCol] });
  }

  return { pe, cape };
}

// Shiller dates are year.month numbers: 1871.01 is January, 2026.1 is October.
function toMonth(value: unknown): string | null {
  if (typeof value !== "number") return null;
  const year = Math.floor(value);
  const month = Math.round((value - year) * 100);
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
