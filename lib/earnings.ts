// Earnings reminders: the business day before a stock reports, every playbook following that stock
// gets an email. Report dates come fresh from FMP on each run (companies move them), and each
// reminder sent is recorded in earnings_notifications so it's never sent twice.
import { createAdminClient } from "@/utils/supabase/admin";
import { escapeHtml, sendEmail } from "./email";

type FmpEarnings = {
  symbol: string;
  date: string; // "YYYY-MM-DD"
  epsEstimated: number | null;
  revenueEstimated: number | null;
};

// A playbook following a stock: any of its steps is on that stock.
type Follower = { playbookId: number; playbookName: string; email: string };

export type EarningsReminderResult = {
  symbol: string;
  nextReport: string | null; // null when FMP has no upcoming report (e.g. ETFs like QQQ, which don't report)
  sent: number;
  failed: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Reminders go out the business day before: Friday's run covers reports on the weekend and Monday.
export function reminderWindow(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const daysAhead = now.getUTCDay() === 5 ? 3 : now.getUTCDay() === 6 ? 2 : 1;
  const until = new Date(now.getTime() + daysAhead * ONE_DAY_MS).toISOString().slice(0, 10);
  return { today, until };
}

// The next scheduled report after today, or null when FMP has none or doesn't cover the symbol
// (our plan gets a "premium" text reply instead of a list for ETFs).
async function getNextEarnings(symbol: string, today: string): Promise<FmpEarnings | null> {
  const apiKey = process.env.FMP_KEY;
  if (!apiKey) throw new Error("FMP_KEY must be configured");

  const response = await fetch(
    `https://financialmodelingprep.com/stable/earnings?symbol=${encodeURIComponent(symbol)}&limit=5&apikey=${apiKey}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;

  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) return null;

  return (
    (data as FmpEarnings[])
      .filter((report) => report.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

// Every stock in any playbook, with the playbooks that follow it.
async function getFollowedStocks(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("alerts")
    .select("stock, email, playbook_id, playbooks(name)")
    .overrideTypes<{ stock: string; email: string; playbook_id: number; playbooks: { name: string | null } | null }[]>();
  if (error) throw new Error(error.message);

  const followers = new Map<string, Map<number, Follower>>();
  for (const step of data ?? []) {
    const byPlaybook = followers.get(step.stock) ?? new Map<number, Follower>();
    byPlaybook.set(step.playbook_id, {
      playbookId: step.playbook_id,
      playbookName: step.playbooks?.name || `Playbook #${step.playbook_id}`,
      email: step.email,
    });
    followers.set(step.stock, byPlaybook);
  }
  return followers;
}

function formatReportDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(value: number | null) {
  if (value == null) return "N/A";
  return value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : `$${value.toFixed(2)}`;
}

function reminderEmail(report: FmpEarnings, follower: Follower, siteUrl: string) {
  const when = formatReportDate(report.date);
  const playbook = escapeHtml(follower.playbookName);
  return {
    subject: `${report.symbol} reports earnings ${when}`,
    html:
      `<h1>${report.symbol} reports earnings ${when}</h1>` +
      `<p>A stock in your playbook <strong>${playbook}</strong> has its earnings report coming up.</p>` +
      `<table><tbody>` +
      `<tr><td>EPS estimate</td><td>${report.epsEstimated != null ? `$${report.epsEstimated.toFixed(2)}` : "N/A"}</td></tr>` +
      `<tr><td>Revenue estimate</td><td>${formatMoney(report.revenueEstimated)}</td></tr>` +
      `</tbody></table>` +
      `<p><a href="${siteUrl}/playbooks/${follower.playbookId}">Open ${playbook}</a></p>`,
  };
}

export async function sendEarningsReminders(siteUrl: string): Promise<EarningsReminderResult[]> {
  const supabase = createAdminClient();
  const followers = await getFollowedStocks(supabase);
  const { today, until } = reminderWindow();
  const results: EarningsReminderResult[] = [];

  for (const [symbol, playbooks] of followers) {
    const report = await getNextEarnings(symbol, today);
    const result: EarningsReminderResult = { symbol, nextReport: report?.date ?? null, sent: 0, failed: 0 };
    results.push(result);
    if (!report || report.date > until) continue;

    for (const follower of playbooks.values()) {
      // Claim the reminder first: the unique (playbook, stock, report date) key means a re-run or an
      // overlapping run gets nothing back here and skips it.
      const { data: claimed, error } = await supabase
        .from("earnings_notifications")
        .upsert(
          { playbook_id: follower.playbookId, symbol, report_date: report.date, email: follower.email },
          { onConflict: "playbook_id,symbol,report_date", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error(`Failed to record earnings reminder: ${error.message}`);
      if (!claimed || claimed.length === 0) continue;

      const { subject, html } = reminderEmail(report, follower, siteUrl);
      if (await sendEmail(follower.email, subject, html)) {
        // Not sent: remove the record so the next run tries again.
        await supabase.from("earnings_notifications").delete().eq("id", claimed[0].id);
        result.failed++;
      } else {
        result.sent++;
      }
    }
  }

  return results;
}
