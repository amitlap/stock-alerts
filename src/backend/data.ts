// Reads for pages, as the signed-in user (row-level security limits them to the user's own rows).
import "server-only";
import { cache } from "react";
import { createClient, unwrap } from "@/backend/supabase/server";
import type { Alert, AlertTransition, Playbook, PlaybookWithSteps } from "@/shared/types";

export const PLAYBOOK_COLUMNS = "id, created_at, name, description, email, type";
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

// The user's playbooks, newest first, each with its steps (for progress in lists and the dashboard).
export async function getPlaybooks(): Promise<PlaybookWithSteps[]> {
  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from("playbooks")
      .select(`${PLAYBOOK_COLUMNS}, alerts(${ALERT_COLUMNS})`)
      .order("created_at", { ascending: false })
      .overrideTypes<PlaybookWithSteps[], { merge: false }>(),
  );
  return rows ?? [];
}

// Whether the signed-in user has a Telegram chat linked.
export async function isTelegramLinked(): Promise<boolean> {
  const supabase = await createClient();
  const link = unwrap(await supabase.from("telegram_links").select("chat_id").maybeSingle<{ chat_id: number | null }>());
  return link?.chat_id != null;
}

export type PlaybookDetail = { playbook: Playbook; steps: Alert[]; transitions: AlertTransition[] };

// One playbook with its steps (oldest first) and the transitions between them; null if it isn't the user's.
export async function getPlaybook(id: number): Promise<PlaybookDetail | null> {
  if (!Number.isInteger(id)) return null;

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
  return { playbook, steps: alerts, transitions: alert_transitions };
}
