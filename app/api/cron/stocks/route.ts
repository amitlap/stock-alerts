import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { getLatestStockPrices } from "@/lib/actions";
import {
  formatAlertCondition,
  formatAlertLabel,
  getErrorMessage,
  getMatchingAlerts,
  type Alert,
} from "@/lib/stockUtils";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

// An active step that matched, with the name of the playbook it belongs to.
type MatchedAlert = Alert & { playbooks?: { name: string | null } | null };

export async function GET(request: Request) {
  // Verify that the request comes from our GitHub Action
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return respond();
}

// "Run check now" on the dashboard: only for logged-in users, since it sends emails and advances
// playbooks for everyone.
export async function POST() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // This route is called by a scheduler with no user session, so it needs the service-role
  // client to bypass RLS; otherwise the updates below would silently match 0 rows.
  const supabase = createAdminClient();
  const { data: alerts, error: alertsError } = await supabase
    .from("alerts")
    .select("id, stock, email, price, operator, isActive, playbooks(name)")
    .eq("isActive", true)
    // A step belongs to one playbook, so the join is a single object, not the array Supabase assumes.
    .overrideTypes<MatchedAlert[], { merge: false }>();

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  // Only the stocks some playbook step is currently watching.
  const stocks = await getLatestStockPrices((alerts ?? []).map((alert) => alert.stock));
  // Claim the matching steps (mark them done) before emailing, so a run that overlaps this one
  // can't email the same step again. Anything that then fails is given back, to retry next run.
  const claimedIds = await claimAlerts(supabase, getMatchingAlerts(alerts ?? [], stocks));
  const matchingAlerts = (alerts ?? []).filter((alert) => alert.id != null && claimedIds.has(alert.id));
  console.log("Stocks fulfilling alert conditions:", matchingAlerts.map(formatAlertLabel));

  // A step fires once its email is sent, and then the steps after it start watching.
  const alertEmails = await sendAlertEmails(matchingAlerts, stocks, emailKey, emailFrom);
  const firedIds = sentAlertIds(alertEmails);
  const unsentIds = [...claimedIds].filter((id) => !firedIds.includes(id));
  const handedOff = await activateTargetAlerts(firedIds, supabase);
  await releaseAlerts(supabase, handedOff ? unsentIds : [...claimedIds]);

  console.log("Stock check completed!");

  return { matchingAlerts, alertEmails };
}

// Sends one email per alert address, listing the stocks whose condition it matched.
async function sendAlertEmails(
  matchingAlerts: MatchedAlert[],
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
        return `<tr><td>${alert.playbooks?.name ?? ""}</td><td>${alert.stock}</td><td>${formatAlertCondition(alert)}</td><td>$${stock?.price?.toFixed(2) ?? "N/A"}</td></tr>`;
      })
      .join("");

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: "A playbook step was triggered",
      html: `<h1>Playbook step triggered</h1><table><thead><tr><th>Playbook</th><th>Symbol</th><th>Condition</th><th>Current price</th></tr></thead><tbody>${rows}</tbody></table>`,
    });

    if (error) {
      console.error(`Failed to send alert email to ${email}:`, error.message);
    }

    results.push({ email, alerts: alertsForEmail, data, error: error?.message ?? null });
  }

  return results;
}

// Marks the given steps done, but only those still active, and returns the ids it actually changed.
// The update is atomic, so when two runs overlap each step is claimed (and emailed) by one of them.
async function claimAlerts(supabase: AdminClient, matching: MatchedAlert[]) {
  const ids = matching.map((alert) => alert.id).filter((id): id is number => id != null);
  if (ids.length === 0) return new Set<number>();

  const { data, error } = await supabase
    .from("alerts")
    .update({ isActive: false, triggered_at: new Date().toISOString() })
    .in("id", ids)
    .eq("isActive", true)
    .select("id");

  if (error) {
    throw new Error(`Failed to claim alerts: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.id as number));
}

// Puts claimed steps back to watching (not fired), so the next run tries them again.
async function releaseAlerts(supabase: AdminClient, ids: number[]) {
  if (await updateAlerts(supabase, ids, { isActive: true, triggered_at: null })) {
    console.log("Released alerts to retry next run:", ids);
  }
}

// The steps whose email went out; only these count as fired.
function sentAlertIds(alertEmails: Awaited<ReturnType<typeof sendAlertEmails>>) {
  return alertEmails
    .filter((result) => !result.error)
    .flatMap((result) => result.alerts)
    .map((alert) => alert.id)
    .filter((id): id is number => id != null);
}

// Starts the next steps: every target of a transition whose source just fired (A -> B starts B).
// Steps that fired in this same run are skipped so they aren't re-enabled to fire twice.
// Returns false when it couldn't, so the fired steps are released and retried next run.
async function activateTargetAlerts(firedIds: number[], supabase: AdminClient) {
  if (firedIds.length === 0) return true;

  const { data: transitions, error } = await supabase
    .from("alert_transitions")
    .select("target_alert_id")
    .in("source_alert_id", firedIds);

  if (error) {
    console.error("Failed to load alert transitions:", error.message);
    return false;
  }

  const targetIds = [...new Set((transitions ?? []).map((t) => t.target_alert_id as number))].filter(
    (id) => !firedIds.includes(id),
  );

  // A last step has nothing to start.
  if (targetIds.length === 0) return true;

  const activated = await updateAlerts(supabase, targetIds, { isActive: true });
  if (activated) console.log("Activated target alerts:", targetIds);
  return activated;
}

// Applies `patch` to the given alerts; returns false when there was nothing to update or the update failed.
async function updateAlerts(
  supabase: AdminClient,
  ids: number[],
  patch: { isActive: boolean; triggered_at?: string | null },
) {
  if (ids.length === 0) return false;

  const { error } = await supabase.from("alerts").update(patch).in("id", ids);

  if (error) {
    console.error(`Failed to update alerts ${ids.join(", ")}:`, error.message);
    return false;
  }

  return true;
}

