"use server";

// Every change the UI makes. Each runs as the signed-in user, so row-level security keeps it to
// their own playbooks, and then refreshes every page (they all show the same data).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { notifyNewComment } from "@/backend/commentNotifications";
import { ALERT_COLUMNS, getUser, isTelegramLinked, PLAYBOOK_COLUMNS } from "@/backend/data";
import { runStockCheck as runStockCheckJob } from "@/backend/jobs/stockCheck";
import { createPlaybook, toAlertFields, toPlaybookFields } from "@/backend/playbooks";
import { getHistoricalPrices, getLatestStockPrices } from "@/backend/prices";
import { createAdminClient } from "@/backend/supabase/admin";
import { createClient, unwrap, unwrapChanged } from "@/backend/supabase/server";
import { createTelegramLink } from "@/backend/telegram";
import { findPriceLevel, type PriceLevel } from "@/shared/playbookTemplates";
import {
  MAX_COMMENT_LENGTH,
  type Alert,
  type NewAlert,
  type NewPlaybook,
  type PlannedStep,
  type Playbook,
  type PlaybookType,
  type StepSource,
} from "@/shared/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Revalidating also refreshes the page that called the action, so the UI never needs router.refresh().
function revalidateApp() {
  revalidatePath("/", "layout");
}

// The signed-in user's email, for actions that act on "my" rows (or must not run for logged-out visitors).
async function requireEmail(): Promise<string> {
  const user = await getUser();
  if (!user?.email) throw new Error("Unauthorized");
  return user.email;
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
  await requireEmail();
  if (!symbol.trim()) return null;

  const [quote] = await getLatestStockPrices([symbol.trim().toUpperCase()]);
  return quote?.price ?? null;
}

// A stock's 3-month resistance or support, for "Find level" in the new-playbook form.
export async function getPriceLevel(symbol: string, kind: "resistance" | "support"): Promise<PriceLevel> {
  await requireEmail();
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

// Public playbooks are visible to the viewers the owner has added.
export async function setPlaybookPublic(id: number, isPublic: boolean): Promise<void> {
  const supabase = await createClient();
  unwrapChanged(await supabase.from("playbooks").update({ is_public: isPublic }).eq("id", id).select("id"), "playbook");
  revalidateApp();
}

// Lets `email` see all the signed-in user's public playbooks. Works whether or not that person has an
// account yet, so this can't be used to find out who has one.
export async function addViewer(email: string): Promise<void> {
  const me = await requireEmail();
  const viewer = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(viewer)) throw new Error("Enter a valid email address");
  if (viewer === me.toLowerCase()) throw new Error("You can already see your own playbooks");

  const supabase = await createClient();
  unwrap(
    await supabase
      .from("playbook_viewers")
      .upsert({ owner_email: me, viewer_email: viewer }, { ignoreDuplicates: true }),
  );
  revalidateApp();
}

export async function removeViewer(email: string): Promise<void> {
  const me = await requireEmail();
  const supabase = await createClient();
  unwrapChanged(
    await supabase
      .from("playbook_viewers")
      .delete()
      .eq("owner_email", me)
      .eq("viewer_email", email)
      .select("viewer_email"),
    "viewer",
  );
  revalidateApp();
}

export async function addComment(playbookId: number, body: string): Promise<void> {
  const email = await requireEmail();
  const text = body.trim();
  if (!text) throw new Error("Write a message first");
  if (text.length > MAX_COMMENT_LENGTH) throw new Error(`Keep it under ${MAX_COMMENT_LENGTH} characters`);

  const supabase = await createClient();
  unwrap(await supabase.from("playbook_comments").insert({ playbook_id: playbookId, author_email: email, body: text }));

  // Tells the others on the playbook once the response is sent, so posting doesn't wait on email.
  // Links point to the site the comment was posted on.
  const request = await headers();
  const siteUrl = request.get("origin") ?? `https://${request.get("host")}`;
  after(() => notifyNewComment({ playbookId, author: email, body: text }, siteUrl));
  revalidateApp();
}

// Allowed for the comment's author and the playbook's owner.
export async function removeComment(id: number): Promise<void> {
  const supabase = await createClient();
  unwrapChanged(await supabase.from("playbook_comments").delete().eq("id", id).select("id"), "comment");
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
  await requireEmail();
  const result = await runStockCheckJob();
  revalidateApp();
  return result;
}

// "Connect Telegram": returns the t.me link that opens the bot and links the chat to this login.
// Only the server writes telegram_links, so it uses the service-role client for the signed-in user's row.
export async function connectTelegram(): Promise<string> {
  return createTelegramLink(createAdminClient(), await requireEmail());
}

// Polled by the Connect Telegram button while it waits for the user to press Start in the bot.
export async function checkTelegramLinked(): Promise<boolean> {
  return isTelegramLinked();
}

export async function disconnectTelegram(): Promise<void> {
  const email = await requireEmail();
  unwrap(
    await createAdminClient()
      .from("telegram_links")
      .update({ chat_id: null, linked_at: null })
      .eq("email", email),
  );
  revalidateApp();
}
