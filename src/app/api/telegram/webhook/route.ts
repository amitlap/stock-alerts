import { NextResponse } from "next/server";
import { escapeHtml } from "@/backend/email";
import { createPlaybook } from "@/backend/playbooks";
import { getLatestStockPrices } from "@/backend/prices";
import { createAdminClient, type AdminClient } from "@/backend/supabase/admin";
import { completeTelegramLink, saveTelegramMessage, sendTelegram, unlinkTelegramChat } from "@/backend/telegram";
import { formatAlertLabel, meetsCondition, parseAlertText } from "@/shared/steps";

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
        ? `Connected! Playbook alerts and earnings reminders for <b>${escapeHtml(email)}</b> will now come here too.\n\nSend an alert like <b>NVDA &gt; 250</b> to create a playbook for it. Send /stop to disconnect.`
        : `This link has expired or was already used. Open the app and click <b>Connect Telegram</b> again.`,
    );
  } else if (text === "/stop") {
    await unlinkTelegramChat(supabase, chatId);
    await sendTelegram(chatId, "Disconnected. You won't get alerts here anymore.");
  } else if (!text) {
    await sendTelegram(chatId, "I can only read text messages for now.");
  } else {
    const emails = await saveTelegramMessage(supabase, chatId, text);
    await sendTelegram(
      chatId,
      emails.length === 0
        ? "To send me messages, first click <b>Connect Telegram</b> in the app."
        : await replyToText(supabase, emails, text, new URL(request.url).origin),
    );
  }

  // Always 200 for a handled update, or Telegram keeps redelivering it.
  return NextResponse.json({ ok: true });
}

// A text like "NVDA > 250" becomes a price-alert playbook for each linked login; any other text was just
// saved. Returns the bot's reply.
async function replyToText(supabase: AdminClient, emails: string[], text: string, siteUrl: string) {
  const alert = parseAlertText(text);
  if (!alert) return "Got it ✓ Refresh the app to see your message.";

  // Check the symbol is real before making a playbook that would never fire.
  const [quote] = await getLatestStockPrices([alert.stock]).catch(() => []);
  if (quote?.price == null) {
    return `Saved your message, but I couldn't find a price for <b>${escapeHtml(alert.stock)}</b>, so no playbook was made.`;
  }

  const label = formatAlertLabel(alert);
  const created = [];
  for (const email of emails) {
    created.push(await createPlaybook(supabase, { name: label, description: "Created from Telegram", email }, [alert]));
  }

  const link = `<a href="${siteUrl}/playbooks/${created[0].id}">${escapeHtml(label)}</a>`;
  const firesNext = meetsCondition(alert, quote.price) ? " It's already past your price, so it fires on the next check." : "";
  return `Got it ✓ Created playbook ${link}. ${alert.stock} is now $${quote.price.toFixed(2)}.${firesNext}\n\nRefresh the app to see it.`;
}
