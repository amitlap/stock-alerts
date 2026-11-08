// Creating playbooks, shared by the app (as the signed-in user) and the Telegram bot (service role, for
// the login linked to the chat). Not in actions.ts, since every export there is callable from the browser.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBOOK_COLUMNS } from "@/backend/data";
import { unwrap } from "@/backend/supabase/server";
import { getStepStatus } from "@/shared/steps";
import {
  ALERT_OPERATORS,
  type Alert,
  type NewAlert,
  type NewPlaybook,
  type PlannedStep,
  type Playbook,
  type PlaybookType,
} from "@/shared/types";

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

// Creates a playbook with its steps. Steps are chained in order (the first watches now, and each later
// step waits for the one before it to fire) unless a step's `after` names another earlier step, or null
// to watch right away.
export async function createPlaybook(
  supabase: SupabaseClient,
  playbook: NewPlaybook,
  steps: PlannedStep[],
  type: PlaybookType,
): Promise<Playbook> {
  if (steps.length === 0 || steps.length > MAX_NEW_PLAYBOOK_STEPS) {
    throw new Error(`A new playbook needs 1 to ${MAX_NEW_PLAYBOOK_STEPS} steps`);
  }
  const sources = steps.map((step, i) => (step.after === undefined ? (i === 0 ? null : i - 1) : step.after));
  if (sources.some((source, i) => source !== null && !(Number.isInteger(source) && source >= 0 && source < i))) {
    throw new Error("A step can only start after an earlier step");
  }
  const fields = toPlaybookFields(playbook);
  const stepFields = steps.map((step, i) => toAlertFields({ ...step, isActive: sources[i] === null }));

  const created = unwrap(
    await supabase.from("playbooks").insert({ ...fields, type }).select(PLAYBOOK_COLUMNS).single<Playbook>(),
  );

  try {
    // Inserted rows come back in the order they were sent.
    const inserted = unwrap(
      await supabase
        .from("alerts")
        .insert(stepFields.map((step) => ({ ...step, playbook_id: created.id })))
        .select("id"),
    );
    const links = inserted.flatMap((step, i) => {
      const source = sources[i];
      if (source === null) return [];
      return [
        {
          playbook_id: created.id,
          source_alert_id: inserted[source].id,
          target_alert_id: step.id,
          explanation: steps[i].explanation?.trim() || null,
        },
      ];
    });
    if (links.length > 0) unwrap(await supabase.from("alert_transitions").insert(links));
  } catch (err) {
    // Don't leave a half-made playbook behind (deleting it deletes its steps and links).
    await supabase.from("playbooks").delete().eq("id", created.id);
    throw err;
  }

  return created;
}

// Adds a step at the end of a playbook's chain: it starts when the current last step fires, or watches
// right away when that one already fired (or the playbook has no steps). Admin callers pass `email` so
// only that login's playbook is changed; it throws when the playbook isn't theirs.
export async function appendStep(supabase: SupabaseClient, playbookId: number, email: string, step: PlannedStep) {
  const playbook = unwrap(
    await supabase
      .from("playbooks")
      .select("id, name, alerts(id, created_at, isActive, triggered_at), alert_transitions(source_alert_id)")
      .eq("id", playbookId)
      .eq("email", email)
      .maybeSingle()
      .overrideTypes<
        | (Pick<Playbook, "id" | "name"> & {
            alerts: Pick<Alert, "id" | "created_at" | "isActive" | "triggered_at">[];
            alert_transitions: { source_alert_id: number }[];
          })
        | null,
        { merge: false }
      >(),
  );
  if (!playbook) throw new Error("That playbook doesn't exist or isn't yours");

  // The last step: the newest one that doesn't start anything yet.
  const sources = new Set(playbook.alert_transitions.map((t) => t.source_alert_id));
  const last = playbook.alerts
    .filter((s) => !sources.has(s.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const watchNow = !last || getStepStatus(last) === "done";

  const created = unwrap(
    await supabase
      .from("alerts")
      .insert({ ...toAlertFields({ ...step, isActive: watchNow }), playbook_id: playbookId })
      .select("id")
      .single<{ id: number }>(),
  );
  if (last) {
    const { error } = await supabase.from("alert_transitions").insert({
      playbook_id: playbookId,
      source_alert_id: last.id,
      target_alert_id: created.id,
      explanation: step.explanation?.trim() || null,
    });
    if (error) {
      // Don't leave a step behind that was meant to follow the last one but doesn't.
      await supabase.from("alerts").delete().eq("id", created.id);
      throw new Error(error.message);
    }
  }

  return { playbook: { id: playbook.id, name: playbook.name }, watchNow };
}

// The login's playbooks to offer when adding a step on `stock`: those already on that stock first,
// then the most recent.
export async function getPlaybookChoices(supabase: SupabaseClient, email: string, stock: string, limit = 5) {
  const playbooks = unwrap(
    await supabase
      .from("playbooks")
      .select("id, name, created_at, alerts(stock)")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(50)
      .overrideTypes<(Pick<Playbook, "id" | "name" | "created_at"> & { alerts: { stock: string }[] })[], { merge: false }>(),
  );
  const onStock = (p: (typeof playbooks)[number]) => p.alerts.some((a) => a.stock === stock);
  return [...playbooks.filter(onStock), ...playbooks.filter((p) => !onStock(p))]
    .slice(0, limit)
    .map((p) => ({ id: p.id, name: p.name }));
}
