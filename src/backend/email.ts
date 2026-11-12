import "server-only";
import { Resend } from "resend";
import { getErrorMessage } from "@/shared/format";

const EMAIL_FROM = "alerts@stock-alerts-alpha.com";

// Sends one email. Returns the failure reason, or null once it's sent; it never throws, so callers
// can give back anything they claimed for it.
export async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "RESEND_API_KEY must be configured";

  try {
    const { error } = await new Resend(apiKey).emails.send({ from: EMAIL_FROM, to: [to], subject, html });
    if (error) console.error(`Failed to send email to ${to}:`, error.message);
    return error?.message ?? null;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
    return getErrorMessage(err);
  }
}

// For text users typed (e.g. playbook names) that goes into an email's HTML.
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
