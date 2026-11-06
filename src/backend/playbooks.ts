// Creating playbooks, shared by the app (as the signed-in user) and the Telegram bot (service role, for
// the login linked to the chat). Not in actions.ts, since every export there is callable from the browser.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBOOK_COLUMNS } from "@/backend/data";
import { unwrap } from "@/backend/supabase/server";
import { ALERT_OPERATORS, type NewAlert, type NewPlaybook, type PlannedStep, type Playbook } from "@/shared/types";

// A playbook made from a template can't have more steps than this.
const MAX_NEW_PLAYBOOK_STEPS = 20;

// Validates a playbook and normalizes the fields a user can edit.
export function toPlaybookFields(playbook: NewPlaybook) {
  if (!playbook.name.trim() || !playbook.email.trim()) {
    throw new Error("Name and email are required");
  }

  return {
    name: playbook.name.trim(),
    description: playbook.description.trim(),
    email: playbook.email.trim(),
  };
}

// Validates a step and normalizes the fields a user can edit.
export function toAlertFields(alert: Omit<NewAlert, "playbook_id">) {
  if (!alert.stock.trim()) {
    throw new Error("Stock is required");
  }
  if (!Number.isFinite(alert.price)) {
    throw new Error("Price must be a number");
  }
  if (!ALERT_OPERATORS.includes(alert.operator)) {
    throw new Error("Invalid operator");
  }

  return {
    stock: alert.stock.trim().toUpperCase(),
    price: alert.price,
    operator: alert.operator,
    isActive: alert.isActive,
    description: alert.description?.trim() || null,
  };
}

// Creates a playbook with its steps chained in order: the first watches now, and each later step
// waits for the one before it to fire.
export async function createPlaybook(
  supabase: SupabaseClient,
  playbook: NewPlaybook,
  steps: PlannedStep[],
): Promise<Playbook> {
  if (steps.length === 0 || steps.length > MAX_NEW_PLAYBOOK_STEPS) {
    throw new Error(`A new playbook needs 1 to ${MAX_NEW_PLAYBOOK_STEPS} steps`);
  }
  const fields = toPlaybookFields(playbook);
  const stepFields = steps.map((step, i) => toAlertFields({ ...step, isActive: i === 0 }));

  const created = unwrap(await supabase.from("playbooks").insert(fields).select(PLAYBOOK_COLUMNS).single<Playbook>());

  try {
    // Inserted rows come back in the order they were sent.
    const inserted = unwrap(
      await supabase
        .from("alerts")
        .insert(stepFields.map((step) => ({ ...step, playbook_id: created.id })))
        .select("id"),
    );
    const links = inserted.slice(1).map((step, i) => ({
      playbook_id: created.id,
      source_alert_id: inserted[i].id,
      target_alert_id: step.id,
      explanation: steps[i + 1].explanation?.trim() || null,
    }));
    if (links.length > 0) unwrap(await supabase.from("alert_transitions").insert(links));
  } catch (err) {
    // Don't leave a half-made playbook behind (deleting it deletes its steps and links).
    await supabase.from("playbooks").delete().eq("id", created.id);
    throw err;
  }

  return created;
}
