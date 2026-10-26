// Stub — notification handling has moved into the main VitePWA service worker (sw.js).
// This file is kept so old registrations can update cleanly rather than 404.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
