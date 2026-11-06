import "server-only";
import { randomBytes } from "node:crypto";
import type { AdminClient } from "@/backend/supabase/admin";
import { unwrap } from "@/backend/supabase/server";

// A "Connect Telegram" link stops working after this long.
const LINK_TOKEN_TTL_MS = 60 * 60 * 1000;

// Sends one Telegram message (HTML formatting: <b>, <i>, <a href>). Returns the failure reason, or
// null once it's sent; like sendEmail, it never throws.
export async function sendTelegram(chatId: number, html: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "TELEGRAM_BOT_TOKEN must be configured";

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
    });
    if (response.ok) return null;

    const { description } = (await response.json().catch(() => ({}))) as { description?: string };
    const error = description ?? `HTTP ${response.status}`;
    console.error(`Failed to send Telegram message to ${chatId}:`, error);
    return error;
  } catch (err) {
    console.error(`Failed to send Telegram message to ${chatId}:`, err);
    return err instanceof Error ? err.message : String(err);
  }
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

// Saves a text the user sent the bot, for each login linked to the chat, and returns those logins'
// emails (none when the chat isn't linked, so there's no one to show it to).
export async function saveTelegramMessage(supabase: AdminClient, chatId: number, text: string): Promise<string[]> {
  const links = unwrap(await supabase.from("telegram_links").select("email").eq("chat_id", chatId));
  const emails = links.map((link) => link.email as string);
  if (emails.length === 0) return [];

  unwrap(await supabase.from("telegram_messages").insert(emails.map((email) => ({ email, chat_id: chatId, text }))));
  return emails;
}

// Stops sending to this chat (the user sent /stop, or blocked the bot).
export async function unlinkTelegramChat(supabase: AdminClient, chatId: number) {
  unwrap(await supabase.from("telegram_links").update({ chat_id: null, linked_at: null }).eq("chat_id", chatId));
}
