import { config, now } from '../config.ts';
import { db } from '../db.ts';
import { graphConfigured, sendMail } from './graph.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export { esc };

/** Sends an email and records it in the Reminders log either way, so there is always a trace. */
export async function send(opts: { to: string[]; audience: 'Employee' | 'HR' | 'Management'; month: string; subject: string; html: string; issueKey?: string | null; files?: { name: string; path: string }[] }): Promise<boolean> {
  const to = opts.to.map((a) => a.trim()).filter(Boolean);
  let sent = false;
  let error = '';
  if (!to.length) error = 'No email address on file.';
  else if (!config().sendEmail) error = 'Email sending is turned off in config.json.';
  else if (!graphConfigured()) error = 'Microsoft 365 is not connected yet (config.json).';
  else {
    try {
      await sendMail(to, opts.subject, opts.html, opts.files ?? []);
      sent = true;
    } catch (e) {
      error = `Sending failed: ${(e as Error).message}`.slice(0, 480);
    }
  }
  await (await db())('notifications').insert({
    at: now(), to_addr: to.join(', ') || '(none)', audience: opts.audience, subject: opts.subject.slice(0, 255), body: opts.html,
    issue_key: opts.issueKey ?? null, month: opts.month, sent: sent ? 1 : 0, error,
  });
  return sent;
}

/** Plain, readable layout for every email the tool sends. */
export function layout(title: string, bodyHtml: string): string {
  const url = esc(config().appUrl);
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#142026;max-width:640px">`
    + `<h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2>${bodyHtml}`
    + `<p style="color:#566a72;font-size:12px;margin-top:24px">Sent automatically by Attendance Desk. <a href="${url}">Open Attendance Desk</a></p></div>`;
}
