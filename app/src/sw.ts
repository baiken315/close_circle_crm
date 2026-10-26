/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching — single SW owns both caching and FCM, eliminating
// the two-SW / skipWaiting fight that was invalidating push subscriptions.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// Firebase messaging (SW context)
const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
});
const messaging = getMessaging(firebaseApp);

function buildAndShowNotification(data: Record<string, string>) {
  const title = data['_title'] || data['title'] || 'Close Circle';
  const body  = data['_body']  || data['body']  || '';
  const completionUrl = data['completionUrl'] || null;

  return self.registration.showNotification(title, {
    body: completionUrl ? body + '\nTap to mark complete' : body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data['reminderId'] || ('notification-' + Date.now()),
    data,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [{ action: 'open', title: 'View' }],
  } as NotificationOptions);
}

// Background / closed — Firebase routes here
onBackgroundMessage(messaging, (payload) => {
  const data = (payload.data ?? {}) as Record<string, string>;
  return buildAndShowNotification(data);
});

// Raw push fallback — catches anything Firebase doesn't route to onBackgroundMessage
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json() as { data?: Record<string, string> };
    const data = payload.data ?? {};
    if (data['_title'] || data['title']) {
      event.waitUntil(buildAndShowNotification(data));
    }
  } catch {
    // unparseable push — ignore
  }
});

// Notification click — default tap completes reminder; 'open' action just navigates
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as Record<string, string>;

  if (event.action === 'open' || !data['completionUrl']) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return (client as WindowClient).focus();
        }
        return self.clients.openWindow('/reminders');
      })
    );
  } else {
    event.waitUntil(
      fetch(data['completionUrl'], { method: 'POST' })
        .then((res) => {
          if (!res.ok) throw new Error('status ' + res.status);
          return self.registration.showNotification('Marked Complete', {
            body: event.notification.title + ' has been completed.',
            icon: '/icons/icon-192x192.png',
            tag: 'complete-confirm',
            requireInteraction: false,
            silent: true,
          });
        })
        .catch(() =>
          self.registration.showNotification('Could not complete', {
            body: 'Please mark it complete from the app.',
            icon: '/icons/icon-192x192.png',
            tag: 'complete-error',
          })
        )
    );
  }
});
