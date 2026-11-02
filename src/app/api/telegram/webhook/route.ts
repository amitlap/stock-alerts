import { NextResponse } from "next/server";
import { escapeHtml } from "@/backend/email";
import { createAdminClient } from "@/backend/supabase/admin";
import { completeTelegramLink, sendTelegram, unlinkTelegramChat } from "@/backend/telegram";

// The fields of a Telegram update this bot reads.
type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  my_chat_member?: { chat: { id: number }; new_chat_member: { status: string } };
};

// Telegram calls this for every message to the bot, with the secret given to setWebhook in a header.
// An unset secret never matches, so a missing env var can't open the endpoint.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const supabase = createAdminClient();

  // The user blocked the bot: stop sending to that chat.
  if (update.my_chat_member?.new_chat_member.status === "kicked") {
    await unlinkTelegramChat(supabase, update.my_chat_member.chat.id);
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim() ?? "";
  if (chatId == null) return NextResponse.json({ ok: true });

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    const email = token ? await completeTelegramLink(supabase, token, chatId) : null;
    await sendTelegram(
      chatId,
      email
        ? `Connected! Playbook alerts and earnings reminders for <b>${escapeHtml(email)}</b> will now come here too. Send /stop to disconnect.`
        : `This link has expired or was already used. Open the app and click <b>Connect Telegram</b> again.`,
    );
  } else if (text === "/stop") {
    await unlinkTelegramChat(supabase, chatId);
    await sendTelegram(chatId, "Disconnected. You won't get alerts here anymore.");
  } else {
    await sendTelegram(chatId, "I only send alerts. To connect, click <b>Connect Telegram</b> in the app.");
  }

  // Always 200 for a handled update, or Telegram keeps redelivering it.
  return NextResponse.json({ ok: true });
}
