// Microsoft Graph (Outlook / Microsoft 365) with app-only access.
// Needs an Azure app registration with the Mail.Read and Mail.Send application permissions. See docs/DEPLOY.md.
import fs from 'node:fs';
import { config } from '../config.ts';
import { getState, setState } from '../repo.ts';

export interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  from?: { emailAddress?: { address?: string; name?: string } };
  body?: { content?: string };
  uniqueBody?: { content?: string };
}

export function graphConfigured(): boolean {
  const m = config().microsoft;
  return Boolean(m.tenantId && m.clientId && m.clientSecret);
}

async function token(): Promise<string> {
  const cached = await getState('graph_token');
  if (cached) {
    const t = JSON.parse(cached) as { token: string; expires: number };
    if (t.expires > Date.now() + 120_000) return t.token;
  }
  const m = config().microsoft;
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(m.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: m.clientId, client_secret: m.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Microsoft sign-in failed: ${body.error_description ?? res.status}`);
  await setState('graph_token', JSON.stringify({ token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 }));
  return body.access_token;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'outlook.body-content-type="text"' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Microsoft Graph ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const mailbox = () => encodeURIComponent(config().microsoft.mailbox);

/** Inbox messages received after `since` (ISO 8601, UTC), oldest first. */
export async function messagesSince(since: string, limit = 50): Promise<GraphMessage[]> {
  const q = new URLSearchParams({
    $filter: `receivedDateTime gt ${since}`,
    $orderby: 'receivedDateTime asc',
    $top: String(limit),
    $select: 'id,subject,from,receivedDateTime,body,uniqueBody,hasAttachments',
  });
  return (await call<{ value: GraphMessage[] }>('GET', `users/${mailbox()}/mailFolders/inbox/messages?${q}`)).value ?? [];
}

export async function attachments(messageId: string): Promise<{ name: string; bytes: Buffer }[]> {
  const list = await call<{ value: { '@odata.type': string; name: string; contentBytes?: string }[] }>('GET', `users/${mailbox()}/messages/${encodeURIComponent(messageId)}/attachments`);
  return (list.value ?? [])
    .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
    .map((a) => ({ name: a.name, bytes: Buffer.from(a.contentBytes ?? '', 'base64') }));
}

export async function sendMail(to: string[], subject: string, html: string, files: { name: string; path: string }[] = []) {
  const sender = encodeURIComponent(config().microsoft.sender || config().microsoft.mailbox);
  await call('POST', `users/${sender}/sendMail`, {
    saveToSentItems: true,
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ...(config().microsoft.replyTo ? { replyTo: [{ emailAddress: { address: config().microsoft.replyTo } }] } : {}),
      attachments: files.map((f) => ({
        '@odata.type': '#microsoft.graph.fileAttachment', name: f.name,
        contentType: f.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentBytes: fs.readFileSync(f.path).toString('base64'),
      })),
    },
  });
}
