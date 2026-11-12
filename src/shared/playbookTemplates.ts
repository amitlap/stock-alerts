// Playbook templates whose steps are worked out from a stock and a start price. Shared by the
// new-playbook form and the Telegram bot, so both make exactly the same playbooks.
import { ladderPrices } from "./steps";
import type { Candle, PlannedStep, PlaybookType } from "./types";

// The types whose steps are worked out from a few numbers (the others start from one step typed in).
export type PlanTemplate = Exclude<PlaybookType, "alert" | "custom">;

export function isPlanTemplate(type: PlaybookType): type is PlanTemplate {
  return type !== "alert" && type !== "custom";
}

// The templates whose start price is a resistance or support level rather than the current price.
const LEVEL_KINDS: Partial<Record<PlanTemplate, "resistance" | "support">> = { breakout: "resistance", support: "support" };

export function levelKind(template: PlanTemplate) {
  return LEVEL_KINDS[template] ?? null;
}

// How many recent trading days the levels come from (about 3 months), leaving out the last few so the
// level isn't just today's price.
const LEVEL_DAYS = 63;
const LEVEL_SKIP_DAYS = 5;

export type PriceLevel = { price: number; error: null } | { price: null; error: string };

// A stock's resistance (the highest high) or support (the lowest low) over the last ~3 months of daily
// candles, oldest first. Only a level on the right side of the latest close counts: a stock already above
// its 3-month high has no resistance overhead, and one below its 3-month low has no support under it, so
// alerts on them would fire right away.
export function findPriceLevel(stock: string, candles: Candle[], kind: "resistance" | "support"): PriceLevel {
  const window = candles.slice(-(LEVEL_DAYS + LEVEL_SKIP_DAYS), -LEVEL_SKIP_DAYS);
  const last = candles.at(-1)?.close;
  if (window.length < 20 || last == null) return { price: null, error: `Not enough price history for ${stock}.` };

  if (kind === "resistance") {
    const price = roundCents(Math.max(...window.map((c) => c.high)));
    return price > last
      ? { price, error: null }
      : { price: null, error: `${stock} ($${last.toFixed(2)}) is already above its 3-month high of $${price}, so there's no resistance to break. Set a level yourself instead.` };
  }
  const price = roundCents(Math.min(...window.map((c) => c.low)));
  return price < last
    ? { price, error: null }
    : { price: null, error: `${stock} ($${last.toFixed(2)}) is already below its 3-month low of $${price}, so there's no support under it. Set a level yourself instead.` };
}

const roundCents = (price: number) => Math.round(price * 100) / 100;

// The % buffers around a level: a breakout must clear resistance by 1%; "near support" is within 2%
// above it, and support has failed 3% below it.
const BREAKOUT_BUFFER = 1;
const NEAR_SUPPORT = 2;
const SUPPORT_FAILS = 3;

export type PlanInput = {
  stock: string;
  start: number;
  count: number;
  percent: number;
  stopPercent: number;
  targetPercent: number;
};

export const PLAN_DEFAULTS = { count: 5, percent: 7, stopPercent: 8, targetPercent: 20 };
export const MAX_LADDER_STEPS = 20;
// The crash plan's drops from the start price, in %, and the index it starts on.
export const CRASH_DROPS = [10, 20, 30];
export const CRASH_DEFAULT_STOCK = "SPY";

const isPercent = (value: number) => Number.isFinite(value) && value > 0;

// A template's steps and the playbook's default name, or null when the input doesn't make one.
export function buildPlan(template: PlanTemplate, input: PlanInput): { steps: PlannedStep[]; name: string } | null {
  const stock = input.stock.trim().toUpperCase();
  const { start } = input;
  if (!stock || !Number.isFinite(start) || start <= 0) return null;

  switch (template) {
    case "stepUp":
    case "dip": {
      const { count, percent } = input;
      if (!isPercent(percent) || !Number.isInteger(count) || count < 1 || count > MAX_LADDER_STEPS) return null;

      const rising = template === "stepUp";
      const prices = ladderPrices(start, count, rising ? percent : -percent);
      if (prices.at(-1)! <= 0) return null;

      const sign = rising ? "+" : "−";
      return {
        steps: prices.map((price, i) => ({
          stock,
          operator: rising ? ">" : "<",
          price,
          description: `Buy #${i + 1}: ${sign}${Math.floor((Math.abs(price - start) * 100) / start)}% from $${start}`,
          explanation: i === 0 ? null : `Price ${rising ? "rose" : "fell"} another ${percent}%`,
        })),
        name: `${stock} ${rising ? "buy as price rises" : "buy the dip"} (${sign}${percent}% × ${count})`,
      };
    }

    case "crash":
      return {
        steps: CRASH_DROPS.map((drop, i) => ({
          stock,
          operator: "<",
          price: Math.floor(start * (1 - drop / 100)),
          description: `Down ${drop}% from $${start}: put a third of your cash to work`,
          explanation: i === 0 ? null : `It fell further, to −${drop}%`,
        })),
        name: `${stock} crash plan (−${CRASH_DROPS.join("% / −")}%)`,
      };

    case "bracket": {
      const { stopPercent: stop, targetPercent: target } = input;
      if (!isPercent(stop) || stop >= 100 || !isPercent(target)) return null;

      return {
        steps: [
          {
            stock,
            operator: "<",
            price: Math.floor(start * (1 - stop / 100)),
            description: `Stop loss: −${stop}% from $${start}`,
            after: null,
          },
          {
            stock,
            operator: ">",
            price: Math.ceil(start * (1 + target / 100)),
            description: `Take profit: +${target}% from $${start}`,
            after: null,
          },
        ],
        name: `${stock} exit bracket (−${stop}% / +${target}%)`,
      };
    }

    case "breakout":
      return {
        steps: [
          {
            stock,
            operator: ">",
            price: roundCents(start * (1 + BREAKOUT_BUFFER / 100)),
            description: `Breakout: ${BREAKOUT_BUFFER}% above resistance at $${start}`,
          },
          {
            stock,
            operator: "<",
            price: start,
            description: `Retest: back at the old resistance, $${start}. A lower-risk place to buy`,
            explanation: "It broke out; now wait for the pullback",
          },
        ],
        name: `${stock} resistance breakout ($${start})`,
      };

    case "support":
      return {
        steps: [
          {
            stock,
            operator: "<",
            price: roundCents(start * (1 + NEAR_SUPPORT / 100)),
            description: `Near support at $${start}: buy zone`,
          },
          {
            stock,
            operator: "<",
            price: roundCents(start * (1 - SUPPORT_FAILS / 100)),
            description: `Support broke (${SUPPORT_FAILS}% below $${start}): get out`,
            explanation: "It reached support; now watch for it to fail",
          },
        ],
        name: `${stock} support bounce ($${start})`,
      };
  }
}

// The words that start a template in a Telegram message.
const TEMPLATE_COMMANDS: Record<string, PlanTemplate> = {
  rise: "stepUp",
  dip: "dip",
  crash: "crash",
  bracket: "bracket",
  breakout: "breakout",
  support: "support",
};

// How to write each template as a message, for the bot's help.
export const TEMPLATE_COMMAND_HELP = [
  "<b>dip NVDA 5 7</b> — buy the dip: 5 buy alerts, each 7% lower",
  "<b>rise NVDA 5 7</b> — buy as price rises: 5 buy alerts, each 7% higher",
  "<b>crash SPY</b> — market crash plan: alerts at −10%, −20% and −30%",
  "<b>bracket NVDA 8 20</b> — exit bracket: stop loss 8% below, take profit 20% above",
  "<b>breakout NVDA</b> — resistance breakout: alert when it breaks above its 3-month high, then when it pulls back to it",
  "<b>support NVDA</b> — support bounce: alert near its 3-month low, then if it breaks below",
];

// The bot's buttons for picking a playbook type once it has a ticker; each is its command word.
export const TEMPLATE_BUTTONS = [
  { command: "dip", label: "📉 Buy the dip" },
  { command: "rise", label: "📈 Buy as it rises" },
  { command: "crash", label: "🚨 Crash plan" },
  { command: "bracket", label: "🎯 Exit bracket" },
  { command: "breakout", label: "🚀 Breakout" },
  { command: "support", label: "🛟 Support bounce" },
];

// Reads a message that's just a ticker, like "NVDA" or "$brk.b"; null when it's anything else.
export function parseTickerText(text: string): string | null {
  const match = /^\s*\$?([A-Za-z][A-Za-z0-9.^-]{0,9})\s*$/.exec(text);
  return match ? match[1].toUpperCase() : null;
}

export type TemplateRequest = Omit<PlanInput, "start"> & { template: PlanTemplate; start: number | null };

// Reads a template typed as text, like "dip NVDA", "/dip nvda 5 7%" or "bracket TSLA 8 20 at 250": the
// command, a ticker (optional for crash, which defaults to SPY), up to two numbers for the ladders and
// the bracket (steps and %, or stop % and target %; left out, they take the defaults) and an optional
// "at <price>" start price, which otherwise is the current price (or, for breakout and support, the
// level found from price history). Null when the text isn't one.
export function parseTemplateText(text: string): TemplateRequest | null {
  const words = text.trim().split(/\s+/);
  const template = TEMPLATE_COMMANDS[words.shift()?.replace(/^\//, "").replace(/@\w+$/, "").toLowerCase() ?? ""];
  if (!template) return null;

  let stock = "";
  let start: number | null = null;
  const numbers: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/^\$/, "").replace(/%$/, "");
    if (word.toLowerCase() === "at" && i + 1 < words.length) {
      start = Number(words[++i].replace(/^\$/, ""));
    } else if (!stock && numbers.length === 0 && /^[A-Za-z][A-Za-z0-9.^-]{0,9}$/.test(word)) {
      stock = word.toUpperCase();
    } else {
      numbers.push(Number(word));
    }
  }
  if (template === "crash" && !stock) stock = CRASH_DEFAULT_STOCK;
  const maxNumbers = template === "crash" || levelKind(template) ? 0 : 2;
  if (!stock || numbers.length > maxNumbers) return null;

  const [first, second] = numbers;
  const ladder = template === "stepUp" || template === "dip";
  return {
    template,
    stock,
    start,
    count: ladder ? (first ?? PLAN_DEFAULTS.count) : PLAN_DEFAULTS.count,
    percent: ladder ? (second ?? PLAN_DEFAULTS.percent) : PLAN_DEFAULTS.percent,
    stopPercent: template === "bracket" ? (first ?? PLAN_DEFAULTS.stopPercent) : PLAN_DEFAULTS.stopPercent,
    targetPercent: template === "bracket" ? (second ?? PLAN_DEFAULTS.targetPercent) : PLAN_DEFAULTS.targetPercent,
  };
}
