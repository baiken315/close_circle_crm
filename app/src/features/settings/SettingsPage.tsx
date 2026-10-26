import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../../lib/auth";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useUIStore } from '../../stores/ui';
import { ExportModal } from '../../components/ExportModal';
import { ImportModal } from '../../components/ImportModal';
import type { User, UserPreferences } from '../../types';

const ACCENT_PRESETS = [
  { label: 'Violet', value: '250,84%,60%' },
  { label: 'Blue', value: '217,91%,60%' },
  { label: 'Cyan', value: '189,94%,43%' },
  { label: 'Emerald', value: '160,84%,39%' },
  { label: 'Teal', value: '173,80%,40%' },
  { label: 'Green', value: '142,71%,45%' },
  { label: 'Amber', value: '38,92%,50%' },
  { label: 'Orange', value: '25,95%,53%' },
  { label: 'Rose', value: '351,100%,64%' },
  { label: 'Pink', value: '330,81%,60%' },
  { label: 'Fuchsia', value: '292,84%,61%' },
  { label: 'Indigo', value: '239,84%,67%' },
];

const FONTS = [
  { label: 'Inter', value: 'Inter', preview: 'The quick brown fox' },
  { label: 'Lora', value: 'Lora', preview: 'The quick brown fox' },
  { label: 'DM Mono', value: 'DM Mono', preview: 'The quick brown fox' },
  { label: 'Nunito', value: 'Nunito', preview: 'The quick brown fox' },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const applyPreferences = useUIStore((s) => s.applyPreferences);
  const setNotificationPermission = useUIStore((s) => s.setNotificationPermission);
  const notificationPermission = useUIStore((s) => s.notificationPermission);

  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/api/users/me'),
  });

  const prefs = userData?.preferences;
  const [saved, setSaved] = useState(false);
  const [notifTestStatus, setNotifTestStatus] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const updatePrefs = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      api.patch<UserPreferences>('/api/users/me/preferences', data),
    onSuccess: (updated) => {
      applyPreferences(updated);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handlePreferenceChange = (data: Partial<UserPreferences>) => {
    updatePrefs.mutate(data);
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMsg("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const testNotification = async () => {
    setNotifTestStatus('testing...');
    try {
      // 1. Check SW registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      const swInfo = registrations.map(r => `${r.scope} active=${r.active?.scriptURL}`).join(' | ');
      console.log('[test] SWs registered:', swInfo || 'none');

      // 2. Try a local notification directly (bypasses FCM/SW entirely)
      if (Notification.permission === 'granted') {
        const reg = registrations.find(r => r.active);
        if (reg) {
          console.log('[test] calling showNotification on', reg.active?.scriptURL);
          try {
            await reg.showNotification('Close Circle Test', {
              body: 'If you see this, local notifications work!',
            });
            console.log('[test] showNotification resolved without error');
            setNotifTestStatus('showNotification called — check OS notification settings if nothing appeared');
          } catch (e) {
            console.error('[test] showNotification threw:', e);
            setNotifTestStatus(`showNotification error: ${e instanceof Error ? e.message : String(e)}`);
          }
          // Also try direct Notification API as fallback
          try {
            new Notification('Close Circle Direct Test', { body: 'Direct Notification API test' });
            console.log('[test] direct Notification() fired');
          } catch (e) {
            console.log('[test] direct Notification() failed:', e);
          }
        } else {
          setNotifTestStatus('No active service worker found');
        }
      } else {
        setNotifTestStatus('Notification permission not granted');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotifTestStatus(`Error: ${msg}`);
      console.error('[test]', err);
    }
  };

  const requestNotifications = async () => {
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      // Try to register FCM token
      try {
        const { getApps, getApp, initializeApp } = await import('firebase/app');
        const { getMessaging, getToken } = await import('firebase/messaging');
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const messaging = getMessaging(app);
        // Use the VitePWA SW — it now owns both Workbox precaching and FCM handling.
        // navigator.serviceWorker.ready resolves once the SW is active, so no race condition.
        const swReg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (token) {
          await api.put('/api/device-tokens', { token, platform: 'web' });
        }
      } catch (err) {
        console.error('[FCM] token registration failed:', err);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Personalize your Close Circle experience</p>
      </div>

      {/* Account info */}
      {userData && (
        <Section title="Account">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent-300 font-bold text-lg">
              {userData.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-100">{userData.name}</p>
              <p className="text-sm text-slate-400">{userData.email}</p>
            </div>
          </div>
        </Section>
      )}

      {/* Change Password */}
      <Section title="Change Password">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
            />
          </div>
          {passwordMsg && (
            <div className={passwordMsg.includes("success") ? "text-emerald-400 text-sm bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-3 py-2" : "text-rose-400 text-sm bg-rose-900/20 border border-rose-800/50 rounded-lg px-3 py-2"}>
              {passwordMsg}
            </div>
          )}
          <button
            onClick={() => void handleChangePassword()}
            disabled={changingPassword}
            className="px-4 py-2 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </Section>

      {/* Accent Color */}
      <Section title="Accent Color">
        <div className="grid grid-cols-6 gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const [h, s, l] = preset.value.split(',');
            const isSelected = prefs?.accent_color === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => handlePreferenceChange({ accent_color: preset.value })}
                title={preset.label}
                className={`w-full aspect-square rounded-xl transition-transform hover:scale-110 ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`}
                style={{ backgroundColor: `hsl(${h} ${s} ${l})` }}
              />
            );
          })}
        </div>
      </Section>

      {/* Font */}
      <Section title="Font">
        <div className="space-y-2">
          {FONTS.map((font) => (
            <button
              key={font.value}
              onClick={() => handlePreferenceChange({ font_family: font.value })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                prefs?.font_family === font.value
                  ? 'bg-accent/10 border-accent/40 text-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="font-medium">{font.label}</span>
              <span style={{ fontFamily: font.value }} className="text-slate-400 text-sm">
                {font.preview}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Layout Density */}
      <Section title="Layout Density">
        <div className="flex gap-3">
          {(['compact', 'default', 'cozy'] as const).map((density) => (
            <button
              key={density}
              onClick={() => handlePreferenceChange({ layout: density })}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium capitalize transition-colors ${
                prefs?.layout === density
                  ? 'bg-accent/10 border-accent/40 text-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {density}
            </button>
          ))}
        </div>
      </Section>

      {/* Color Scheme */}
      <Section title="Color Scheme">
        <div className="flex gap-3">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => handlePreferenceChange({ theme })}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium capitalize transition-colors ${
                prefs?.theme === theme
                  ? 'bg-accent/10 border-accent/40 text-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Push Notifications">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">
              {notificationPermission === 'granted'
                ? 'Notifications are enabled'
                : notificationPermission === 'denied'
                ? 'Notifications are blocked in your browser'
                : 'Enable notifications for reminders and birthdays'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {notificationPermission === 'granted'
                ? 'You\'ll receive push notifications for due reminders and upcoming dates'
                : 'You can change this in your browser settings at any time'}
            </p>
          </div>
          <button
            onClick={() => void requestNotifications()}
            disabled={notificationPermission === 'denied' || notificationPermission === 'granted'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              notificationPermission === 'granted'
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 cursor-default'
                : notificationPermission === 'denied'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-accent hover:bg-accent-400 text-white'
            }`}
          >
            {notificationPermission === 'granted' ? 'Enabled' :
             notificationPermission === 'denied' ? 'Blocked' :
             'Enable'}
          </button>
        </div>
        {notificationPermission === 'granted' && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-3">
            <button
              onClick={() => void testNotification()}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Send test notification
            </button>
            {notifTestStatus && (
              <span className="text-xs text-slate-400">{notifTestStatus}</span>
            )}
          </div>
        )}
      </Section>

      {/* Export */}
      <Section title="Export">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Export your contacts to CSV or vCard format</p>
            <p className="text-xs text-slate-500 mt-0.5">Choose scope and format, then download your contacts</p>
          </div>
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-400 text-white text-sm font-medium transition-colors"
          >
            Export Contacts
          </button>
        </div>
      </Section>

      {/* Import */}
      <Section title="Import">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Import contacts from CSV or vCard file</p>
            <p className="text-xs text-slate-500 mt-0.5">Drag and drop your file or choose it from your device</p>
          </div>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
          >
            Import Contacts
          </button>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Sign out of your account</p>
            <p className="text-xs text-slate-500 mt-0.5">You will need to sign in again to access Close Circle</p>
          </div>
          <button
            onClick={() => { clearAuth(); navigate("/login", { replace: true }); }}
            className="px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-800/50 text-rose-300 border border-rose-700/50 text-sm font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </Section>

      {/* Modals */}
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {/* Save status */}
      {saved && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Settings saved
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        {children}
      </div>
    </div>
  );
}
