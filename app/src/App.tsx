import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { ContactsPage } from './features/contacts/ContactsPage';
import { RemindersPage } from './features/reminders/RemindersPage';
import { DatesPage } from './features/dates/DatesPage';
import { ChatPage } from './features/chat/ChatPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { isAuthenticated, clearAuth } from './lib/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to='/login' replace />;
  }
  return <>{children}</>;
}

function LogoutPage() {
  const navigate = useNavigate();
  useEffect(() => {
    clearAuth();
    navigate('/login', { replace: true });
  }, [navigate]);
  return null;
}

async function setupForegroundNotifications(): Promise<(() => void) | undefined> {
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const [{ getApps, getApp, initializeApp }, { getMessaging, getToken, onMessage }, { api }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
      import('./lib/api'),
    ]);
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    };
    const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(firebaseApp);
    const swReg = await navigator.serviceWorker.ready;
    try {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
        serviceWorkerRegistration: swReg,
      });
      if (token) {
        await api.put('/api/device-tokens', { token, platform: 'web' });
      }
    } catch {}
    const unsubscribe = onMessage(messaging, (payload) => {
      const data = (payload.data ?? {}) as Record<string, string>;
      const title = data['_title'] || 'Close Circle';
      const body = data['_body'] || '';
      const completionUrl = data['completionUrl'] || null;
      void swReg.showNotification(title, {
        body: completionUrl ? body + '\nTap to mark complete' : body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: data['reminderId'] || ('notification-' + Date.now()),
        data,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: 'View' }],
      } as NotificationOptions);
    });
    return unsubscribe;
  } catch (err) {
    console.error('[FCM] foreground handler setup failed:', err);
  }
}

export function App() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void setupForegroundNotifications().then(u => { unsubscribe = u; });
    return () => unsubscribe?.();
  }, []);

  return (
    <Routes>
      <Route path='/login' element={<LoginPage />} />
      <Route path='/logout' element={<LogoutPage />} />
      <Route
        path='/'
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to='/contacts' replace />} />
        <Route path='contacts' element={<ContactsPage />} />
        <Route path='reminders' element={<RemindersPage />} />
        <Route path='dates' element={<DatesPage />} />
        <Route path='chat' element={<ChatPage />} />
        <Route path='settings' element={<SettingsPage />} />
      </Route>
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}
