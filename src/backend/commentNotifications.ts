// Comment notifications: when someone comments on a playbook, the others in the conversation get an
// email (and a Telegram message, if that login linked one): the playbook's owner, and anyone who
// commented on it before and can still see it. Viewers who haven't joined in aren't told, so friends
// you share with only hear about the conversations they're part of.
import "server-only";
import { escapeHtml, sendEmail } from "@/backend/email";
import { createAdminClient } from "@/backend/supabase/admin";
import { unwrap } from "@/backend/supabase/server";
import { getTelegramChatIds, sendTelegram } from "@/backend/telegram";

export type NewComment = { playbookId: number; author: string; body: string };

// Who hears about a comment by `author`. An earlier commenter only counts while they can still see the
// playbook: it's public and they're still one of the owner's `viewers` (empty when it's private), so a
// removed viewer never gets the text of a playbook they've lost access to. Emails compare ignoring case.
export function commentRecipients(author: string, owner: string, commenters: string[], viewers: string[]): string[] {
  const canSee = new Set(viewers.map((email) => email.toLowerCase()));
  const recipients = new Map<string, string>();
  for (const email of [owner, ...commenters.filter((email) => canSee.has(email.toLowerCase()))]) {
    if (!recipients.has(email.toLowerCase())) recipients.set(email.toLowerCase(), email);
  }
  recipients.delete(author.toLowerCase());
  return [...recipients.values()];
}

// Sends the notifications for a comment that was just posted, with links to `siteUrl`. Uses the
// service-role client, since the author may be a viewer, who can't read the owner's other viewers.
// Never throws: the comment is already saved, so a failure here is only logged.
export async function notifyNewComment(comment: NewComment, siteUrl: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const [playbook] = unwrap(
      await supabase
        .from("playbooks")
        .select("name, email, is_public")
        .eq("id", comment.playbookId)
        .overrideTypes<{ name: string; email: string; is_public: boolean }[], { merge: false }>(),
    );
    if (!playbook) return;

    const commenters = unwrap(
      await supabase.from("playbook_comments").select("author_email").eq("playbook_id", comment.playbookId),
    ).map((row) => row.author_email as string);
    const viewers = playbook.is_public
      ? unwrap(await supabase.from("playbook_viewers").select("viewer_email").eq("owner_email", playbook.email)).map(
          (row) => row.viewer_email as string,
        )
      : [];

    const recipients = commentRecipients(comment.author, playbook.email, commenters, viewers);
    if (recipients.length === 0) return;

    const link = `${siteUrl}/playbooks/${comment.playbookId}`;
    const name = escapeHtml(playbook.name);
    const author = escapeHtml(comment.author);
    const body = escapeHtml(comment.body);
    const chatIds = await getTelegramChatIds(supabase, recipients);

    await Promise.all(
      recipients.map(async (email) => {
        await sendEmail(
          email,
          `New comment on ${playbook.name}`,
          `<h1>New comment on ${name}</h1>` +
            `<p><strong>${author}</strong> wrote:</p>` +
            `<blockquote>${body.replace(/\n/g, "<br>")}</blockquote>` +
            `<p><a href="${link}">Open ${name}</a></p>` +
            `<p>You're getting this because you own or commented on this playbook.</p>`,
        );
        const chatId = chatIds.get(email);
        if (chatId != null) {
          await sendTelegram(chatId, `💬 <b>${author}</b> commented on <a href="${link}">${name}</a>:\n${body}`);
        }
      }),
    );
  } catch (err) {
    console.error(`Failed to send notifications for a comment on playbook ${comment.playbookId}:`, err);
  }
}
