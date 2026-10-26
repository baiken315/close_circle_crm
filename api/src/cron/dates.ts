import type { Database, Env } from '../db.js';
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
    console.log(`[dates] OAuth token error ${tokenResponse.status}: ${text.slice(0, 200)}`);
    throw new Error(`Failed to get FCM access token: ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json() as { access_token: string };
  console.log(`[dates] OAuth token obtained, length=${tokenData.access_token?.length}`);
  return tokenData.access_token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  tag: string,
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
          data: { _title: title, _body: body },
          // Pure data-only message — no webpush.notification block.
          // Data-only messages use FCM's background data wakeup path, which is
          // more reliable on Android Chrome than notification messages.
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
      console.log(`[dates] FCM error ${response.status}: ${errorCode ?? error?.error?.message}`);
    } catch {
      console.log(`[dates] FCM error ${response.status}: ${text.slice(0, 200)}`);
    }
    if (errorCode === 'UNREGISTERED') return false;
  }

  return true;
}

export async function checkUpcomingDates(db: Database, env: Env): Promise<void> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const todaysDates = await db.query<{
    id: string;
    user_id: string;
    title: string;
    date: string | Date;
    notes: string | null;
    last_notified_year: number | null;
    contact_name: string;
  }>(
    `SELECT d.id, d.user_id, d.title, d.date, d.notes, d.last_notified_year, c.full_name as contact_name
     FROM important_dates d
     JOIN contacts c ON d.contact_id = c.id
     WHERE extract(month FROM d.date) = ? AND extract(day FROM d.date) = ?
     AND (d.last_notified_year IS NULL OR d.last_notified_year != ?)`,
    [todayMonth, todayDay, currentYear]
  );

  console.log(`[dates] found ${todaysDates.length} date(s) for ${currentYear}-${String(todayMonth).padStart(2,'0')}-${String(todayDay).padStart(2,'0')}`);
  if (todaysDates.length === 0) return;

  const emailConfig = getEmailConfig();

  let accessToken: string | null = null;
  let serviceAccount: FCMServiceAccount | null = null;
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON && env.FCM_PROJECT_ID) {
    try {
      serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as FCMServiceAccount;
      accessToken = await getAccessToken(serviceAccount);
    } catch (err) {
      console.log(`[dates] FCM setup failed: ${err}`);
    }
  }

  for (const date of todaysDates) {
    const dateObj = date.date instanceof Date ? date.date : new Date(date.date);
    const year = dateObj.getUTCFullYear();
    const age = year && year > 1900 ? currentYear - year : null;

    const title = `${date.title}: ${date.contact_name}`;
    const body = age
      ? `Turning ${age} today${date.notes ? ` — ${date.notes}` : ''}`
      : date.notes ?? 'Today!';
    const tag = `date-${date.id}-${currentYear}`;

    // --- FCM push ---
    if (accessToken && serviceAccount) {
      const deviceTokens = await db.query<{ id: string; token: string }>(
        'SELECT id, token FROM device_tokens WHERE user_id = ?',
        [date.user_id]
      );

      if (deviceTokens.length === 0) {
        console.log(`[dates] no device tokens for user ${date.user_id}, skipping date ${date.id}`);
      }

      for (const deviceToken of deviceTokens) {
        console.log(`[dates] sending FCM for date ${date.id} to ...${deviceToken.token.slice(-8)}`);
        const success = await sendFCMNotification(
          accessToken,
          env.FCM_PROJECT_ID,
          deviceToken.token,
          title,
          body,
          tag,
        );
        if (!success) {
          console.log(`[dates] token invalid, removing ...${deviceToken.token.slice(-8)}`);
          await db.execute('DELETE FROM device_tokens WHERE id = ?', [deviceToken.id]);
        } else {
          console.log(`[dates] FCM sent OK for date ${date.id}`);
        }
      }
    }

    // --- Email fallback ---
    if (emailConfig) {
      const notifyEmail = process.env['NOTIFICATION_EMAIL'];
      if (notifyEmail) {
        const text = [
          title,
          body,
        ].join('\n');

        const emoji = date.title.toLowerCase().includes('birthday') ? '🎂' : '📅';
        const html = `
          <div style="font-family:sans-serif;max-width:480px">
            <h2 style="margin:0 0 4px">${emoji} ${title}</h2>
            <p style="margin:0;color:#555">${body}</p>
          </div>`;

        try {
          await sendEmail(emailConfig, {
            to: notifyEmail,
            subject: `${emoji} ${title}`,
            text,
            html,
          });
          console.log(`[dates] email sent to ${notifyEmail} for date ${date.id}`);
        } catch (err) {
          console.log(`[dates] email failed for date ${date.id}: ${err}`);
        }
      }
    }

    await db.execute(
      'UPDATE important_dates SET last_notified_year = ? WHERE id = ?',
      [currentYear, date.id]
    );
  }
}
