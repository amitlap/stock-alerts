import "server-only";
import { randomBytes } from "node:crypto";
import type { AdminClient } from "@/backend/supabase/admin";
import { unwrap } from "@/backend/supabase/server";

// A "Connect Telegram" link stops working after this long.
const LINK_TOKEN_TTL_MS = 60 * 60 * 1000;

// An inline keyboard: rows of buttons, each sending `data` back to the webhook when tapped (Telegram
// allows up to 64 bytes of it).
export type TelegramButton = { text: string; data: string };

// Calls a Bot API method. Returns the failure reason, or null once it worked; it never throws.
async function callTelegram(method: string, body: object): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "TELEGRAM_BOT_TOKEN must be configured";

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;

    const { description } = (await response.json().catch(() => ({}))) as { description?: string };
    const error = description ?? `HTTP ${response.status}`;
    console.error(`Telegram ${method} failed:`, error);
    return error;
  } catch (err) {
    console.error(`Telegram ${method} failed:`, err);
    return err instanceof Error ? err.message : String(err);
  }
}

function messageBody(html: string, buttons?: TelegramButton[][]) {
  return {
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    // Left out when there are no buttons; an edit without it also removes the old ones.
    ...(buttons && {
      reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) },
    }),
  };
}

// Sends one Telegram message (HTML formatting: <b>, <i>, <a href>), optionally with buttons. Returns the
// failure reason, or null once it's sent; like sendEmail, it never throws.
export function sendTelegram(chatId: number, html: string, buttons?: TelegramButton[][]): Promise<string | null> {
  return callTelegram("sendMessage", { chat_id: chatId, ...messageBody(html, buttons) });
}

// Replaces a message the bot sent (its buttons go away unless new ones are given).
export function editTelegramMessage(chatId: number, messageId: number, html: string, buttons?: TelegramButton[][]) {
  return callTelegram("editMessageText", { chat_id: chatId, message_id: messageId, ...messageBody(html, buttons) });
}

// Acknowledges a button tap, so the button stops showing a spinner.
export function answerTelegramButton(callbackQueryId: string) {
  return callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

// The linked chat for each of these login emails (emails with no linked chat are left out).
export async function getTelegramChatIds(supabase: AdminClient, emails: string[]): Promise<Map<string, number>> {
  if (emails.length === 0) return new Map();

  const links = unwrap(
    await supabase.from("telegram_links").select("email, chat_id").in("email", emails).not("chat_id", "is", null),
  );
  return new Map(links.map((link) => [link.email as string, link.chat_id as number]));
}

// Starts linking `email`: stores a fresh one-time token and returns the t.me link that hands it to the bot.
export async function createTelegramLink(supabase: AdminClient, email: string): Promise<string> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) throw new Error("TELEGRAM_BOT_USERNAME must be configured");

  // Telegram allows A-Z, a-z, 0-9, _ and - in a start parameter, which base64url fits.
  const token = randomBytes(24).toString("base64url");
  unwrap(
    await supabase
      .from("telegram_links")
      .upsert({ email, link_token: token, link_token_created_at: new Date().toISOString() }, { onConflict: "email" }),
  );
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${token}`;
}

// Links the chat that sent "/start <token>" to the token's login. Returns that email, or null when the
// token is unknown or expired.
export async function completeTelegramLink(supabase: AdminClient, token: string, chatId: number): Promise<string | null> {
  const notBefore = new Date(Date.now() - LINK_TOKEN_TTL_MS).toISOString();
  const linked = unwrap(
    await supabase
      .from("telegram_links")
      .update({ chat_id: chatId, linked_at: new Date().toISOString(), link_token: null, link_token_created_at: null })
      .eq("link_token", token)
      .gte("link_token_created_at", notBefore)
      .select("email"),
  );
  return (linked[0]?.email as string | undefined) ?? null;
}

// Saves a text the user sent the bot, for each login linked to the chat, and returns the saved rows
// (none when the chat isn't linked, so there's no one to show it to).
export async function saveTelegramMessage(
  supabase: AdminClient,
  chatId: number,
  text: string,
): Promise<{ id: number; email: string }[]> {
  const links = unwrap(await supabase.from("telegram_links").select("email").eq("chat_id", chatId));
  if (links.length === 0) return [];

  return unwrap(
    await supabase
      .from("telegram_messages")
      .insert(links.map((link) => ({ email: link.email as string, chat_id: chatId, text })))
      .select("id, email")
      .overrideTypes<{ id: number; email: string }[], { merge: false }>(),
  );
}

// Marks a saved message from this chat as handled (a button under it was tapped) and returns it, or
// null when it isn't from this chat or was already handled, so each one is acted on once.
export async function claimTelegramMessage(supabase: AdminClient, messageId: number, chatId: number) {
  const [claimed] = unwrap(
    await supabase
      .from("telegram_messages")
      .update({ handled_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("chat_id", chatId)
      .is("handled_at", null)
      .select("email, text")
      .overrideTypes<{ email: string; text: string }[], { merge: false }>(),
  );
  return claimed ?? null;
}

// Stops sending to this chat (the user sent /stop, or blocked the bot).
export async function unlinkTelegramChat(supabase: AdminClient, chatId: number) {
  unwrap(await supabase.from("telegram_links").update({ chat_id: null, linked_at: null }).eq("chat_id", chatId));
}
