import { NextResponse } from "next/server";
import { escapeHtml } from "@/backend/email";
import { appendStep, createPlaybook, getPlaybookChoices } from "@/backend/playbooks";
import { getLatestStockPrices } from "@/backend/prices";
import { createAdminClient, type AdminClient } from "@/backend/supabase/admin";
import {
  answerTelegramButton,
  claimTelegramMessage,
  completeTelegramLink,
  editTelegramMessage,
  saveTelegramMessage,
  sendTelegram,
  unlinkTelegramChat,
  type TelegramButton,
} from "@/backend/telegram";
import { formatAlertLabel, meetsCondition, parseAlertText } from "@/shared/steps";

// The fields of a Telegram update this bot reads.
type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  my_chat_member?: { chat: { id: number }; new_chat_member: { status: string } };
  // A tap on a button under one of the bot's messages.
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
};

// Button data: "new:<message id>" makes a new playbook from a saved alert text, and
// "add:<message id>:<playbook id>" adds it as the last step of that playbook.
const BUTTON_DATA = /^(new|add):(\d+)(?::(\d+))?$/;

// Telegram calls this for every message to the bot, with the secret given to setWebhook in a header.
// An unset secret never matches, so a missing env var can't open the endpoint.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const supabase = createAdminClient();
  const siteUrl = new URL(request.url).origin;

  // The user blocked the bot: stop sending to that chat.
  if (update.my_chat_member?.new_chat_member.status === "kicked") {
    await unlinkTelegramChat(supabase, update.my_chat_member.chat.id);
    return NextResponse.json({ ok: true });
  }

  if (update.callback_query) {
    await handleButton(supabase, update.callback_query, siteUrl);
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
        ? `Connected! Playbook alerts and earnings reminders for <b>${escapeHtml(email)}</b> will now come here too.\n\nSend an alert like <b>NVDA &gt; 250</b> to create a playbook or add a step to one. Send /stop to disconnect.`
        : `This link has expired or was already used. Open the app and click <b>Connect Telegram</b> again.`,
    );
  } else if (text === "/stop") {
    await unlinkTelegramChat(supabase, chatId);
    await sendTelegram(chatId, "Disconnected. You won't get alerts here anymore.");
  } else if (!text) {
    await sendTelegram(chatId, "I can only read text messages for now.");
  } else {
    await replyToText(supabase, chatId, text);
  }

  // Always 200 for a handled update, or Telegram keeps redelivering it.
  return NextResponse.json({ ok: true });
}

// Saves the text. One like "NVDA > 250" also gets buttons: a new playbook, or a step in one of the
// login's playbooks. A chat is normally linked to one login; with several, the first one's are offered.
async function replyToText(supabase: AdminClient, chatId: number, text: string) {
  const saved = await saveTelegramMessage(supabase, chatId, text);
  if (saved.length === 0) {
    await sendTelegram(chatId, "To send me messages, first click <b>Connect Telegram</b> in the app.");
    return;
  }

  const alert = parseAlertText(text);
  if (!alert) {
    await sendTelegram(chatId, "Got it ✓ Refresh the app to see your message.");
    return;
  }

  // Check the symbol is real before offering a step that would never fire.
  const [quote] = await getLatestStockPrices([alert.stock]).catch(() => []);
  if (quote?.price == null) {
    await sendTelegram(
      chatId,
      `Saved your message, but I couldn't find a price for <b>${escapeHtml(alert.stock)}</b>, so there's nothing to add.`,
    );
    return;
  }

  const { id: messageId, email } = saved[0];
  const choices = await getPlaybookChoices(supabase, email, alert.stock);
  const buttons: TelegramButton[][] = [
    [{ text: "➕ New playbook", data: `new:${messageId}` }],
    ...choices.map((playbook) => [{ text: `Add to: ${truncate(playbook.name, 40)}`, data: `add:${messageId}:${playbook.id}` }]),
  ];
  const firesNext = meetsCondition(alert, quote.price) ? " It's already past your price, so it fires as soon as it's watching." : "";
  await sendTelegram(
    chatId,
    `<b>${escapeHtml(formatAlertLabel(alert))}</b> — ${alert.stock} is now $${quote.price.toFixed(2)}.${firesNext}\n\nWhere should it go?`,
    buttons,
  );
}

// A tap on "New playbook" or "Add to: …": does it once, then replaces the buttons with the result.
async function handleButton(
  supabase: AdminClient,
  query: NonNullable<TelegramUpdate["callback_query"]>,
  siteUrl: string,
) {
  await answerTelegramButton(query.id);

  const match = BUTTON_DATA.exec(query.data ?? "");
  if (!match || !query.message) return;
  const [, action, messageId, playbookId] = match;
  const { chat, message_id: botMessageId } = query.message;

  // Null when it was already tapped (the result is already showing) or isn't from this chat.
  const saved = await claimTelegramMessage(supabase, Number(messageId), chat.id);
  const alert = saved && parseAlertText(saved.text);
  if (!saved || !alert) return;

  const label = escapeHtml(formatAlertLabel(alert));
  const link = (id: number, name: string) => `<a href="${siteUrl}/playbooks/${id}">${escapeHtml(name)}</a>`;
  let result: string;
  try {
    if (action === "new") {
      const playbook = await createPlaybook(
        supabase,
        { name: formatAlertLabel(alert), description: "Created from Telegram", email: saved.email },
        [alert],
      );
      result = `Got it ✓ Created playbook ${link(playbook.id, playbook.name)}.`;
    } else {
      const { playbook, watchNow } = await appendStep(supabase, Number(playbookId), saved.email, {
        ...alert,
        explanation: "Added from Telegram",
      });
      result =
        `Got it ✓ Added <b>${label}</b> to ${link(playbook.id, playbook.name)}. ` +
        (watchNow ? "It's watching now." : "It starts when the step before it fires.");
    }
  } catch (err) {
    console.error("Telegram button failed:", err);
    result = `Couldn't do that: ${escapeHtml(err instanceof Error ? err.message : String(err))}\n\nSend <b>${label}</b> again to retry.`;
    await editTelegramMessage(chat.id, botMessageId, result);
    return;
  }

  await editTelegramMessage(chat.id, botMessageId, `${result}\n\nRefresh the app to see it.`);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
