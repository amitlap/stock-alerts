// Earnings reminders (Supabase Cron, daily): the business day before a stock reports, every playbook
// following that stock gets an email (and a Telegram message, if that login linked one). Report dates come fresh from FMP on each run (companies move
// them), and each reminder sent is recorded in earnings_notifications so it's never sent twice.
import "server-only";
import { escapeHtml, sendEmail } from "@/backend/email";
import { getNextEarnings, type EarningsReport } from "@/backend/fmp";
import { createAdminClient, type AdminClient } from "@/backend/supabase/admin";
import { unwrap } from "@/backend/supabase/server";
import { getTelegramChatIds, sendTelegram } from "@/backend/telegram";

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
function reminderWindow(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const daysAhead = now.getUTCDay() === 5 ? 3 : now.getUTCDay() === 6 ? 2 : 1;
  const until = new Date(now.getTime() + daysAhead * ONE_DAY_MS).toISOString().slice(0, 10);
  return { today, until };
}

// Every stock in any playbook, with the playbooks that follow it.
async function getFollowedStocks(supabase: AdminClient) {
  const steps = unwrap(
    await supabase
      .from("alerts")
      .select("stock, playbook_id, playbooks(name, email)")
      .overrideTypes<{ stock: string; playbook_id: number; playbooks: { name: string; email: string } }[]>(),
  );

  const followers = new Map<string, Map<number, Follower>>();
  for (const step of steps) {
    const byPlaybook = followers.get(step.stock) ?? new Map<number, Follower>();
    byPlaybook.set(step.playbook_id, {
      playbookId: step.playbook_id,
      playbookName: step.playbooks.name || `Playbook #${step.playbook_id}`,
      email: step.playbooks.email,
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

function reminderEmail(report: EarningsReport, follower: Follower, siteUrl: string) {
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

function reminderTelegram(report: EarningsReport, follower: Follower, siteUrl: string) {
  return (
    `<b>${report.symbol} reports earnings ${formatReportDate(report.date)}</b>\n` +
    `In your playbook <a href="${siteUrl}/playbooks/${follower.playbookId}">${escapeHtml(follower.playbookName)}</a>\n` +
    `EPS estimate: ${report.epsEstimated != null ? `$${report.epsEstimated.toFixed(2)}` : "N/A"}\n` +
    `Revenue estimate: ${formatMoney(report.revenueEstimated)}`
  );
}

// Links in the emails point to `siteUrl` (the deployed site the cron job called).
export async function sendEarningsReminders(siteUrl: string): Promise<EarningsReminderResult[]> {
  const supabase = createAdminClient();
  const followers = await getFollowedStocks(supabase);
  const { today, until } = reminderWindow();
  const emails = [...new Set([...followers.values()].flatMap((playbooks) => [...playbooks.values()].map((f) => f.email)))];
  const chatIds = await getTelegramChatIds(supabase, emails).catch((err) => {
    console.error("Failed to load Telegram links:", err);
    return new Map<string, number>();
  });
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
        const chatId = chatIds.get(follower.email);
        if (chatId != null) await sendTelegram(chatId, reminderTelegram(report, follower, siteUrl));
      }
    }
  }

  return results;
}
