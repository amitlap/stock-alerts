import { NextResponse } from "next/server";
import { escapeHtml } from "@/backend/email";
import { appendStep, createPlaybook, getPlaybookChoices } from "@/backend/playbooks";
import { getHistoricalPrices, getLatestStockPrices } from "@/backend/prices";
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
import {
  buildPlan,
  levelKind,
  parseTemplateText,
  findPriceLevel,
  TEMPLATE_COMMAND_HELP,
  type PriceLevel,
  type TemplateRequest,
} from "@/shared/playbookTemplates";
import { formatAlertLabel, meetsCondition, parseAlertText } from "@/shared/steps";

// The fields of a Telegram update this bot reads.
type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  my_chat_member?: { chat: { id: number }; new_chat_member: { status: string } };
  // A tap on a button under one of the bot's messages.
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
};

// Button data: "new:<message id>" makes a new playbook from a saved alert text,
// "add:<message id>:<playbook id>" adds it as the last step of that playbook, and
// "plan:<message id>:<start price in cents>" makes the playbook a saved template text describes, from the
// price shown in its preview (so what's created matches what was shown).
const BUTTON_DATA = /^(new|add|plan):(\d+)(?::(\d+))?$/;

// Every kind of playbook the bot can make, for /start and /help.
const HELP = [
  "Send me any of these to make a playbook:",
  "<b>NVDA &gt; 250</b> or <b>NVDA &lt; 180</b> — a price alert, as a new playbook or the next step in one of yours (that's how you build a custom playbook)",
  ...TEMPLATE_COMMAND_HELP,
  "",
  "The numbers are optional (defaults as shown). Prices start from the current price; add <b>at 250</b> to start from another.",
].join("\n");

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
        ? `Connected! Playbook alerts and earnings reminders for <b>${escapeHtml(email)}</b> will now come here too.\n\n${HELP}\n\nSend /help to see this again, or /stop to disconnect.`
        : `This link has expired or was already used. Open the app and click <b>Connect Telegram</b> again.`,
    );
  } else if (text === "/help") {
    await sendTelegram(chatId, HELP);
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

  const request = parseTemplateText(text);
  if (request) {
    await replyToTemplate(chatId, saved[0].id, request);
    return;
  }

  const alert = parseAlertText(text);
  if (!alert) {
    await sendTelegram(chatId, "Got it ✓ Refresh the app to see your message. Send /help to see how to make playbooks here.");
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

// The price a template starts from when the text doesn't give one: the 3-month resistance or support for
// breakout and support, otherwise the current price.
async function findStartPrice(request: TemplateRequest): Promise<PriceLevel> {
  const kind = levelKind(request.template);
  if (kind) {
    const candles = await getHistoricalPrices(request.stock).catch(() => []);
    return findPriceLevel(request.stock, candles, kind);
  }
  const [quote] = await getLatestStockPrices([request.stock]).catch(() => []);
  return quote?.price == null
    ? { price: null, error: `I couldn't find a price for ${request.stock}.` }
    : { price: Math.floor(quote.price), error: null };
}

// The playbook a template text (like "dip NVDA 5 7") describes, from `start` or the price it starts from;
// the reason instead when it can't be made.
async function planFromRequest(
  request: TemplateRequest,
  start?: number,
): Promise<{ error: string } | { plan: NonNullable<ReturnType<typeof buildPlan>>; start: number }> {
  let price = request.start ?? start;
  if (price == null) {
    const found = await findStartPrice(request);
    if (found.error !== null) return { error: found.error };
    price = found.price;
  }

  const plan = buildPlan(request.template, { ...request, start: price });
  if (!plan) return { error: "Those numbers don't make a playbook." };
  return { plan, start: price };
}

// Replies to a template text with a preview of its steps and a button that creates it.
async function replyToTemplate(chatId: number, messageId: number, request: TemplateRequest) {
  const result = await planFromRequest(request);
  if ("error" in result) {
    await sendTelegram(chatId, `Saved your message, but ${escapeHtml(result.error)}\n\n${HELP}`);
    return;
  }

  const { plan, start } = result;
  const lines = plan.steps.map(
    (step) => `• <b>${escapeHtml(formatAlertLabel(step))}</b> — ${escapeHtml(step.description ?? "")}`,
  );
  const together = plan.steps.every((step) => step.after === null);
  await sendTelegram(
    chatId,
    `<b>${escapeHtml(plan.name)}</b>\n${lines.join("\n")}\n\n` +
      (together ? "All of them watch from the start." : "Each starts when the one before it fires."),
    [[{ text: "➕ Create playbook", data: `plan:${messageId}:${Math.round(start * 100)}` }]],
  );
}

// A tap on "New playbook", "Add to: …" or "Create playbook": does it once, then replaces the buttons
// with the result.
async function handleButton(
  supabase: AdminClient,
  query: NonNullable<TelegramUpdate["callback_query"]>,
  siteUrl: string,
) {
  await answerTelegramButton(query.id);

  const match = BUTTON_DATA.exec(query.data ?? "");
  if (!match || !query.message) return;
  const [, action, messageId, extra] = match;
  const { chat, message_id: botMessageId } = query.message;

  // Null when it was already tapped (the result is already showing) or isn't from this chat.
  const saved = await claimTelegramMessage(supabase, Number(messageId), chat.id);
  if (!saved) return;
  const request = action === "plan" ? parseTemplateText(saved.text) : null;
  const alert = action === "plan" ? null : parseAlertText(saved.text);
  if (!request && !alert) return;

  const label = escapeHtml(alert ? formatAlertLabel(alert) : saved.text);
  const link = (id: number, name: string) => `<a href="${siteUrl}/playbooks/${id}">${escapeHtml(name)}</a>`;
  let result: string;
  try {
    if (request) {
      const planned = await planFromRequest(request, Number(extra) / 100);
      if ("error" in planned) throw new Error(planned.error);
      const playbook = await createPlaybook(
        supabase,
        { name: planned.plan.name, description: "Created from Telegram", email: saved.email },
        planned.plan.steps,
      );
      result = `Got it ✓ Created playbook ${link(playbook.id, playbook.name)} with ${planned.plan.steps.length} steps.`;
    } else if (!alert) {
      return;
    } else if (action === "new") {
      const playbook = await createPlaybook(
        supabase,
        { name: formatAlertLabel(alert), description: "Created from Telegram", email: saved.email },
        [alert],
      );
      result = `Got it ✓ Created playbook ${link(playbook.id, playbook.name)}.`;
    } else {
      const { playbook, watchNow } = await appendStep(supabase, Number(extra), saved.email, {
        ...alert,
        explanation: "Added from Telegram",
      });
      result =
        `Got it ✓ Added <b>${label}</b> to ${link(playbook.id, playbook.name)}. ` +
        (watchNow ? "It's watching now." : "It starts when the step before it fires.");
    }
  } catch (err) {
    console.error("Telegram button failed:", err);
    await showResult(
      chat.id,
      botMessageId,
      `Couldn't do that: ${escapeHtml(err instanceof Error ? err.message : String(err))}\n\nSend <b>${label}</b> again to retry.`,
    );
    return;
  }

  await showResult(chat.id, botMessageId, `${result}\n\nRefresh the app to see it.`);
}

// Replaces the buttons with the result; if Telegram won't edit that message, sends the result as a new
// one instead, so a tap never looks like it did nothing.
async function showResult(chatId: number, botMessageId: number, html: string) {
  if (await editTelegramMessage(chatId, botMessageId, html)) await sendTelegram(chatId, html);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
