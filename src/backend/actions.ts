"use server";

// Every change the UI makes. Each runs as the signed-in user, so row-level security keeps it to
// their own playbooks, and then refreshes every page (they all show the same data).
import { revalidatePath } from "next/cache";
import { ALERT_COLUMNS, getUser, isTelegramLinked, PLAYBOOK_COLUMNS } from "@/backend/data";
import { runStockCheck as runStockCheckJob } from "@/backend/jobs/stockCheck";
import { createPlaybook, toAlertFields, toPlaybookFields } from "@/backend/playbooks";
import { getHistoricalPrices, getLatestStockPrices } from "@/backend/prices";
import { createAdminClient } from "@/backend/supabase/admin";
import { createClient, unwrap, unwrapChanged } from "@/backend/supabase/server";
import { createTelegramLink } from "@/backend/telegram";
import { findPriceLevel, type PriceLevel } from "@/shared/playbookTemplates";
import {
  type Alert,
  type NewAlert,
  type NewPlaybook,
  type PlannedStep,
  type Playbook,
  type PlaybookType,
  type StepSource,
} from "@/shared/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidateApp() {
  revalidatePath("/", "layout");
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

// Creates a playbook with its steps chained in order: the first watches now, and each later step
// waits for the one before it to fire.
export async function addPlaybook(playbook: NewPlaybook, steps: PlannedStep[], type: PlaybookType): Promise<Playbook> {
  const created = await createPlaybook(await createClient(), playbook, steps, type);
  revalidateApp();
  return created;
}

// The live price of one stock, for "use current price" in the new-playbook form; null if unknown.
export async function getStockPrice(symbol: string): Promise<number | null> {
  if (!(await getUser())) throw new Error("Unauthorized");
  if (!symbol.trim()) return null;

  const [quote] = await getLatestStockPrices([symbol.trim().toUpperCase()]);
  return quote?.price ?? null;
}

// A stock's 3-month resistance or support, for "Find level" in the new-playbook form.
export async function getPriceLevel(symbol: string, kind: "resistance" | "support"): Promise<PriceLevel> {
  if (!(await getUser())) throw new Error("Unauthorized");
  const stock = symbol.trim().toUpperCase();
  if (!stock) return { price: null, error: "Fill in the stock first." };

  return findPriceLevel(stock, await getHistoricalPrices(stock), kind);
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

// "Connect Telegram": returns the t.me link that opens the bot and links the chat to this login.
// Only the server writes telegram_links, so it uses the service-role client for the signed-in user's row.
export async function connectTelegram(): Promise<string> {
  const user = await getUser();
  if (!user?.email) throw new Error("Unauthorized");
  return createTelegramLink(createAdminClient(), user.email);
}

// Polled by the Connect Telegram button while it waits for the user to press Start in the bot.
export async function checkTelegramLinked(): Promise<boolean> {
  return isTelegramLinked();
}

export async function disconnectTelegram(): Promise<void> {
  const user = await getUser();
  if (!user?.email) throw new Error("Unauthorized");

  unwrap(
    await createAdminClient()
      .from("telegram_links")
      .update({ chat_id: null, linked_at: null })
      .eq("email", user.email),
  );
  revalidateApp();
}
