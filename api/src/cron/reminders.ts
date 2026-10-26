import type { Database, Env } from '../db.js';
import { generateHmac } from '../routes/notifications.js';
import { getEmailConfig, sendEmail } from '../notifications/email.js';

interface FCMServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getAccessToken(serviceAccount: FCMServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    console.log(`[reminders] OAuth token error ${tokenResponse.status}: ${text.slice(0, 200)}`);
    throw new Error(`Failed to get FCM access token: ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json() as { access_token: string };
  console.log(`[reminders] OAuth token obtained, length=${tokenData.access_token?.length}`);
  return tokenData.access_token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          // data fields are passed to the SW's onBackgroundMessage/push handler
          data: {
            ...(data ?? {}),
            _title: title,
            _body: body,
          },
          // Pure data-only message — no webpush.notification block.
          // Data-only messages use FCM's background data wakeup path, which is
          // more reliable on Android Chrome than notification messages (which try
          // to render natively and can be silently dropped when Chrome is frozen).
          // The SW's onBackgroundMessage / raw push handler displays the notification.
          android: { priority: 'HIGH' },
          webpush: { headers: { Urgency: 'high' } },
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let errorCode: string | undefined;
    try {
      const error = JSON.parse(text) as { error?: { message?: string; details?: Array<{ errorCode?: string }> } };
      errorCode = error?.error?.details?.[0]?.errorCode;
      console.log(`[reminders] FCM error ${response.status}: ${errorCode ?? error?.error?.message}`);
    } catch {
      console.log(`[reminders] FCM error ${response.status}: ${text.slice(0, 200)}`);
    }
    if (errorCode === 'UNREGISTERED') return false;
    return true;
  }

  console.log(`[reminders] FCM accepted`);
  return true;
}

export async function checkDueReminders(db: Database, env: Env): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 5 * 60 * 1000);

  const dueReminders = await db.query<{
    id: string;
    user_id: string;
    title: string;
    notes: string | null;
    due_date: string;
    contact_name: string | null;
  }>(
    `SELECT r.id, r.user_id, r.title, r.notes, r.due_date, c.full_name as contact_name
     FROM reminders r
     LEFT JOIN contacts c ON r.contact_id = c.id
     WHERE r.completed = false
     AND r.notified_at IS NULL
     AND r.due_date BETWEEN ? AND ?`,
    [windowStart.toISOString(), now.toISOString()]
  );

  console.log(`[reminders] found ${dueReminders.length} due in window ${windowStart.toISOString()} → ${now.toISOString()}`);
  if (dueReminders.length === 0) return;

  const apiBase = process.env['API_BASE_URL'] ?? 'https://close-circle-v2.onrender.com';
  const emailConfig = getEmailConfig();

  // Only bother getting an FCM token if we have credentials
  let accessToken: string | null = null;
  let serviceAccount: FCMServiceAccount | null = null;
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON && env.FCM_PROJECT_ID) {
    try {
      serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as FCMServiceAccount;
      accessToken = await getAccessToken(serviceAccount);
    } catch (err) {
      console.log(`[reminders] FCM setup failed: ${err}`);
    }
  }

  for (const reminder of dueReminders) {
    const title = reminder.title;
    const body = reminder.contact_name
      ? `Re: ${reminder.contact_name}${reminder.notes ? ` — ${reminder.notes}` : ''}`
      : reminder.notes ?? 'Tap to view';

    const completionToken = await generateHmac(
      `${reminder.id}:${reminder.user_id}`,
      env.COMPLETION_SECRET
    );
    const completionUrl = `${apiBase}/api/reminders/${reminder.id}/complete?token=${completionToken}`;

    // --- FCM push ---
    if (accessToken && serviceAccount) {
      const deviceTokens = await db.query<{ id: string; token: string }>(
        'SELECT id, token FROM device_tokens WHERE user_id = ?',
        [reminder.user_id]
      );

      if (deviceTokens.length === 0) {
        console.log(`[reminders] no device tokens for user ${reminder.user_id}`);
      }

      for (const deviceToken of deviceTokens) {
        console.log(`[reminders] sending FCM for reminder ${reminder.id} to ...${deviceToken.token.slice(-8)}`);
        const success = await sendFCMNotification(
          accessToken,
          env.FCM_PROJECT_ID,
          deviceToken.token,
          title,
          body,
          { reminderId: reminder.id, completionUrl }
        );
        if (!success) {
          console.log(`[reminders] token invalid, removing ...${deviceToken.token.slice(-8)}`);
          await db.execute('DELETE FROM device_tokens WHERE id = ?', [deviceToken.id]);
        }
      }
    }

    // --- Email fallback ---
    if (emailConfig) {
      const notifyEmail = process.env['NOTIFICATION_EMAIL'];
      if (notifyEmail) {
        const dueAt = new Date(reminder.due_date).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        });
        const text = [
          `Reminder: ${title}`,
          body !== 'Tap to view' ? body : '',
          `Due: ${dueAt}`,
          '',
          `Mark complete: ${completionUrl}`,
        ].filter(Boolean).join('\n');

        const html = `
          <div style="font-family:sans-serif;max-width:480px">
            <h2 style="margin:0 0 4px">⏰ ${title}</h2>
            ${body !== 'Tap to view' ? `<p style="margin:0 0 8px;color:#555">${body}</p>` : ''}
            <p style="margin:0 0 16px;color:#888;font-size:13px">Due: ${dueAt}</p>
            <a href="${completionUrl}"
               style="display:inline-block;padding:10px 20px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
              ✓ Mark Complete
            </a>
          </div>`;

        try {
          await sendEmail(emailConfig, {
            to: notifyEmail,
            subject: `⏰ Reminder: ${title}`,
            text,
            html,
          });
          console.log(`[reminders] email sent to ${notifyEmail} for reminder ${reminder.id}`);
        } catch (err) {
          console.log(`[reminders] email failed for reminder ${reminder.id}: ${err}`);
        }
      }
    }

    await db.execute(
      'UPDATE reminders SET notified_at = ? WHERE id = ?',
      [now.toISOString(), reminder.id]
    );
  }
}
