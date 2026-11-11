// Reads for pages, as the signed-in user (row-level security limits them to the user's own rows and
// the public playbooks shared with them).
import "server-only";
import { cache } from "react";
import { createClient, unwrap } from "@/backend/supabase/server";
import type { Alert, AlertTransition, Playbook, PlaybookComment, PlaybookWithSteps } from "@/shared/types";

export const PLAYBOOK_COLUMNS = "id, created_at, name, description, email, type, is_public";
export const ALERT_COLUMNS =
  "id, created_at, stock, price, operator, isActive, description, playbook_id, triggered_at";
const TRANSITION_COLUMNS = "id, created_at, playbook_id, source_alert_id, target_alert_id, explanation";

// Cached per request, so the layout and the page share one lookup.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The user's own playbooks, newest first, each with its steps (for progress in lists and the dashboard).
// Filtered by owner because row-level security also lets through playbooks shared with the user.
export async function getPlaybooks(): Promise<PlaybookWithSteps[]> {
  const user = await getUser();
  if (!user?.email) return [];

  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from("playbooks")
      .select(`${PLAYBOOK_COLUMNS}, alerts(${ALERT_COLUMNS})`)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .overrideTypes<PlaybookWithSteps[], { merge: false }>(),
  );
  return rows ?? [];
}

// Other people's public playbooks that they added the user as a viewer of, newest first.
export async function getSharedPlaybooks(): Promise<PlaybookWithSteps[]> {
  const user = await getUser();
  if (!user?.email) return [];

  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from("playbooks")
      .select(`${PLAYBOOK_COLUMNS}, alerts(${ALERT_COLUMNS})`)
      .neq("email", user.email)
      .order("created_at", { ascending: false })
      .overrideTypes<PlaybookWithSteps[], { merge: false }>(),
  );
  return rows ?? [];
}

// The emails the user has added as viewers of their public playbooks.
export async function getViewers(): Promise<string[]> {
  const user = await getUser();
  if (!user?.email) return [];

  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from("playbook_viewers")
      .select("viewer_email")
      .eq("owner_email", user.email)
      .order("viewer_email"),
  );
  return rows.map((row) => row.viewer_email);
}

// A playbook's comments, oldest first; empty if the user can't see the playbook.
export async function getPlaybookComments(playbookId: number): Promise<PlaybookComment[]> {
  const supabase = await createClient();
  return unwrap(
    await supabase
      .from("playbook_comments")
      .select("id, created_at, playbook_id, author_email, body")
      .eq("playbook_id", playbookId)
      .order("created_at")
      .overrideTypes<PlaybookComment[], { merge: false }>(),
  );
}

// Whether the signed-in user has a Telegram chat linked.
export async function isTelegramLinked(): Promise<boolean> {
  const supabase = await createClient();
  const link = unwrap(await supabase.from("telegram_links").select("chat_id").maybeSingle<{ chat_id: number | null }>());
  return link?.chat_id != null;
}

export type PlaybookDetail = { playbook: Playbook; steps: Alert[]; transitions: AlertTransition[]; isOwner: boolean };

// One playbook with its steps (oldest first) and the transitions between them; null if the user can't see it.
export async function getPlaybook(id: number): Promise<PlaybookDetail | null> {
  if (!Number.isInteger(id)) return null;

  const user = await getUser();
  const supabase = await createClient();
  const row = unwrap(
    await supabase
      .from("playbooks")
      .select(`${PLAYBOOK_COLUMNS}, alerts(${ALERT_COLUMNS}), alert_transitions(${TRANSITION_COLUMNS})`)
      .eq("id", id)
      .order("created_at", { referencedTable: "alerts" })
      .maybeSingle()
      .overrideTypes<(Playbook & { alerts: Alert[]; alert_transitions: AlertTransition[] }) | null, { merge: false }>(),
  );
  if (!row) return null;

  const { alerts, alert_transitions, ...playbook } = row;
  return { playbook, steps: alerts, transitions: alert_transitions, isOwner: playbook.email === user?.email };
}
