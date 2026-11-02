"use server";

// Every change the UI makes. Each runs as the signed-in user, so row-level security keeps it to
// their own playbooks, and then refreshes every page (they all show the same data).
import { revalidatePath } from "next/cache";
import { ALERT_COLUMNS, getUser, PLAYBOOK_COLUMNS } from "@/backend/data";
import { runStockCheck as runStockCheckJob } from "@/backend/jobs/stockCheck";
import { createClient, unwrap, unwrapChanged } from "@/backend/supabase/server";
import {
  ALERT_OPERATORS,
  type Alert,
  type FirstStep,
  type NewAlert,
  type NewPlaybook,
  type Playbook,
  type StepSource,
} from "@/shared/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidateApp() {
  revalidatePath("/", "layout");
}

// Validates a playbook and normalizes the fields a user can edit.
function toPlaybookFields(playbook: NewPlaybook) {
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
function toAlertFields(alert: Omit<NewAlert, "playbook_id">) {
  if (!alert.stock.trim() || !alert.email.trim()) {
    throw new Error("Stock and email are required");
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
    email: alert.email.trim(),
    isActive: alert.isActive,
    description: alert.description?.trim() || null,
  };
}

// Makes `after` the only step that `stepId` starts after (keeping that link if it already exists);
// null means the step starts on its own.
async function setStepSource(supabase: SupabaseClient, playbookId: number, stepId: number, after: StepSource | null) {
  if (after) {
    if (after.sourceAlertId === stepId) throw new Error("A step can't start after itself");
    const source = unwrap(
      await supabase.from("alerts").select("id").eq("id", after.sourceAlertId).eq("playbook_id", playbookId).maybeSingle(),
    );
    if (!source) throw new Error("The step it starts after isn't in this playbook");
  }

  let stale = supabase.from("alert_transitions").delete().eq("target_alert_id", stepId);
  if (after) stale = stale.neq("source_alert_id", after.sourceAlertId);
  unwrap(await stale);

  if (!after) return;

  const explanation = after.explanation?.trim() || null;
  const updated = unwrap(
    await supabase
      .from("alert_transitions")
      .update({ explanation })
      .eq("source_alert_id", after.sourceAlertId)
      .eq("target_alert_id", stepId)
      .select("id"),
  );
  if (updated.length === 0) {
    unwrap(
      await supabase.from("alert_transitions").insert({
        playbook_id: playbookId,
        source_alert_id: after.sourceAlertId,
        target_alert_id: stepId,
        explanation,
      }),
    );
  }
}

// Creates a playbook together with its first, active step.
export async function addPlaybook(playbook: NewPlaybook, firstStep: FirstStep): Promise<Playbook> {
  const fields = toPlaybookFields(playbook);
  const stepFields = toAlertFields({ ...firstStep, email: fields.email, isActive: true });

  const supabase = await createClient();
  const created = unwrap(await supabase.from("playbooks").insert(fields).select(PLAYBOOK_COLUMNS).single<Playbook>());

  const { error } = await supabase.from("alerts").insert({ ...stepFields, playbook_id: created.id });
  if (error) {
    // Don't leave a playbook with no steps behind.
    await supabase.from("playbooks").delete().eq("id", created.id);
    throw new Error(error.message);
  }

  revalidateApp();
  return created;
}

export async function updatePlaybook(id: number, playbook: NewPlaybook): Promise<Playbook> {
  const supabase = await createClient();
  const [updated] = unwrapChanged<Playbook>(
    await supabase.from("playbooks").update(toPlaybookFields(playbook)).eq("id", id).select(PLAYBOOK_COLUMNS),
    "playbook",
  );
  revalidateApp();
  return updated;
}

// Deleting a playbook also deletes its steps and transitions (on delete cascade).
export async function removePlaybook(id: number): Promise<void> {
  const supabase = await createClient();
  unwrapChanged(await supabase.from("playbooks").delete().eq("id", id).select("id"), "playbook");
  revalidateApp();
}

// Adds a step to a playbook, optionally starting after an existing step of the same playbook.
export async function addAlert(alert: NewAlert, after?: StepSource | null): Promise<Alert> {
  const supabase = await createClient();
  const created = unwrap(
    await supabase
      .from("alerts")
      .insert({ ...toAlertFields(alert), playbook_id: alert.playbook_id })
      .select(ALERT_COLUMNS)
      .single<Alert>(),
  );

  if (after) {
    try {
      await setStepSource(supabase, alert.playbook_id, created.id, after);
    } catch (err) {
      // Don't leave a step behind that was meant to follow another one but doesn't.
      await supabase.from("alerts").delete().eq("id", created.id);
      throw err;
    }
  }

  revalidateApp();
  return created;
}

// Updates a step's fields and, unless `after` is undefined, which step it starts after.
// A step stays in the playbook it was created in.
export async function updateAlert(id: number, alert: NewAlert, after?: StepSource | null): Promise<Alert> {
  const supabase = await createClient();
  const [updated] = unwrapChanged<Alert>(
    await supabase.from("alerts").update(toAlertFields(alert)).eq("id", id).select(ALERT_COLUMNS),
    "step",
  );

  if (after !== undefined) {
    await setStepSource(supabase, updated.playbook_id, id, after);
  }

  revalidateApp();
  return updated;
}

// Deleting a step also deletes the transitions into and out of it (on delete cascade).
export async function removeAlert(id: number): Promise<void> {
  const supabase = await createClient();
  unwrapChanged(await supabase.from("alerts").delete().eq("id", id).select("id"), "step");
  revalidateApp();
}

// "Run check now" on the dashboard: the same check the cron job runs. Only for logged-in users, since
// it sends emails and advances playbooks for everyone.
export async function runStockCheck(): Promise<{ fired: string[]; emailErrors: string[] }> {
  if (!(await getUser())) throw new Error("Unauthorized");

  const result = await runStockCheckJob();
  revalidateApp();
  return result;
}
