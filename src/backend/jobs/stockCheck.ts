// The stock check (Supabase Cron every 5 minutes, or "Run check now"): every watching step whose
// condition the live price meets fires, which means:
//   1. claim it (mark it done) so an overlapping run can't fire it too,
//   2. email it, grouped into one email per address,
//   3. start the steps that follow it (A -> B starts B),
//   4. give back what didn't make it, so the next run retries it.
import "server-only";
import { escapeHtml, sendEmail } from "@/backend/email";
import { getLatestStockPrices } from "@/backend/prices";
import { formatAlertCondition, formatAlertLabel, meetsCondition } from "@/shared/steps";
import { createAdminClient, type AdminClient } from "@/backend/supabase/admin";
import { unwrap } from "@/backend/supabase/server";
import type { Alert } from "@/shared/types";

// A watching step, with the name of the playbook it belongs to.
type WatchingStep = Pick<Alert, "id" | "stock" | "email" | "price" | "operator"> & {
  playbooks: { name: string | null } | null;
};

export async function runStockCheck() {
  // No user session here, so it uses the service-role client to see (and update) every playbook.
  const supabase = createAdminClient();
  const watching = unwrap(
    await supabase
      .from("alerts")
      .select("id, stock, email, price, operator, playbooks(name)")
      .eq("isActive", true)
      // A step belongs to one playbook, so the join is a single object, not the array Supabase assumes.
      .overrideTypes<WatchingStep[], { merge: false }>(),
  );

  const stocks = await getLatestStockPrices(watching.map((step) => step.stock));
  const prices = new Map(stocks.map((stock) => [stock.symbol, stock.price]));
  const hits = watching.filter((step) => {
    const price = prices.get(step.stock);
    return price != null && meetsCondition(step, price);
  });

  const claimed = await claimSteps(supabase, hits);
  const { sent, errors } = await emailSteps(claimed, prices);
  const sentIds = sent.map((step) => step.id);
  const started = await startNextSteps(supabase, sentIds);
  // Without the next steps started, the playbook would stall, so fire everything again next run.
  await releaseSteps(
    supabase,
    claimed.map((step) => step.id).filter((id) => !started || !sentIds.includes(id)),
  );

  console.log("Stock check fired:", sent.map(formatAlertLabel));
  return { fired: sent.map(formatAlertLabel), emailErrors: errors };
}

// Marks the steps done, but only those still watching, and returns the ones it actually changed.
// The update is atomic, so when two runs overlap each step is claimed (and emailed) by one of them.
async function claimSteps(supabase: AdminClient, steps: WatchingStep[]) {
  if (steps.length === 0) return [];

  const claimed = unwrap(
    await supabase
      .from("alerts")
      .update({ isActive: false, triggered_at: new Date().toISOString() })
      .in("id", steps.map((step) => step.id))
      .eq("isActive", true)
      .select("id"),
  );
  const claimedIds = new Set(claimed.map((row) => row.id as number));
  return steps.filter((step) => claimedIds.has(step.id));
}

// Sends one email per address listing its steps; returns the steps that went out and the failures.
async function emailSteps(steps: WatchingStep[], prices: Map<string, number | undefined>) {
  const byEmail = new Map<string, WatchingStep[]>();
  for (const step of steps) byEmail.set(step.email, [...(byEmail.get(step.email) ?? []), step]);

  const sent: WatchingStep[] = [];
  const errors: string[] = [];

  for (const [email, stepsForEmail] of byEmail) {
    const rows = stepsForEmail
      .map(
        (step) =>
          `<tr><td>${escapeHtml(step.playbooks?.name ?? "")}</td><td>${step.stock}</td><td>${formatAlertCondition(step)}</td><td>$${prices.get(step.stock)?.toFixed(2) ?? "N/A"}</td></tr>`,
      )
      .join("");

    const error = await sendEmail(
      email,
      "A playbook step was triggered",
      `<h1>Playbook step triggered</h1><table><thead><tr><th>Playbook</th><th>Symbol</th><th>Condition</th><th>Current price</th></tr></thead><tbody>${rows}</tbody></table>`,
    );

    if (error) errors.push(`${email}: ${error}`);
    else sent.push(...stepsForEmail);
  }

  return { sent, errors };
}

// Starts every target of a transition whose source just fired. Steps that fired in this same run are
// skipped so they aren't re-enabled to fire twice. Returns false when it couldn't.
async function startNextSteps(supabase: AdminClient, firedIds: number[]) {
  if (firedIds.length === 0) return true;

  const { data: transitions, error } = await supabase
    .from("alert_transitions")
    .select("target_alert_id")
    .in("source_alert_id", firedIds);
  if (error) {
    console.error("Failed to load alert transitions:", error.message);
    return false;
  }

  const targetIds = [...new Set(transitions.map((t) => t.target_alert_id as number))].filter(
    (id) => !firedIds.includes(id),
  );
  return updateSteps(supabase, targetIds, { isActive: true });
}

// Puts claimed steps back to watching (not fired), so the next run tries them again.
async function releaseSteps(supabase: AdminClient, ids: number[]) {
  if (await updateSteps(supabase, ids, { isActive: true, triggered_at: null })) {
    if (ids.length > 0) console.log("Released steps to retry next run:", ids);
  }
}

// Applies `patch` to the given steps; returns false only when the update failed.
async function updateSteps(supabase: AdminClient, ids: number[], patch: { isActive: boolean; triggered_at?: null }) {
  if (ids.length === 0) return true;

  const { error } = await supabase.from("alerts").update(patch).in("id", ids);
  if (error) {
    console.error(`Failed to update steps ${ids.join(", ")}:`, error.message);
    return false;
  }
  return true;
}
