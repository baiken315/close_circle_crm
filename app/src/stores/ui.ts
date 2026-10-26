import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '../types';

interface UIState {
  sidebarOpen: boolean;
  notificationPermission: NotificationPermission | 'unknown';
  preferences: UserPreferences | null;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setNotificationPermission: (perm: NotificationPermission) => void;
  setPreferences: (prefs: UserPreferences) => void;
  applyPreferences: (prefs: UserPreferences) => void;
}

const DENSITY_MAP = { compact: 0.85, default: 1, cozy: 1.15 };

// Read by the inline script in index.html so the saved theme applies before React mounts.
const THEME_STORAGE_KEY = 'cc-theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme: UserPreferences['theme'] = 'system';

function syncThemeClass() {
  const dark = currentTheme === 'dark' || (currentTheme === 'system' && systemDark.matches);
  document.documentElement.classList.toggle('dark', dark);
}

// In "system" mode, follow OS-level light/dark changes live.
systemDark.addEventListener('change', syncThemeClass);

function applyTheme(theme: UserPreferences['theme'] | undefined) {
  currentTheme = theme ?? 'system';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  } catch {
    // storage unavailable — theme still applies for this session
  }
  syncThemeClass();
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      notificationPermission: 'unknown',
      preferences: null,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setNotificationPermission: (perm) => set({ notificationPermission: perm }),

      setPreferences: (prefs) => {
        set({ preferences: prefs });
      },

      applyPreferences: (prefs) => {
        set({ preferences: prefs });
        const root = document.documentElement;

        // Apply accent color (stored as "h,s%,l%" or just hue)
        const parts = prefs.accent_color?.split(',');
        if (parts && parts.length === 3) {
          root.style.setProperty('--accent-h', parts[0] ?? '250');
          root.style.setProperty('--accent-s', parts[1] ?? '84%');
          root.style.setProperty('--accent-l', parts[2] ?? '60%');
        }

        // Apply font
        const fontMap: Record<string, string> = {
          Inter: "'Inter', sans-serif",
          Lora: "'Lora', serif",
          'DM Mono': "'DM Mono', monospace",
          Nunito: "'Nunito', sans-serif",
        };
        root.style.setProperty('--font-body', fontMap[prefs.font_family] ?? "'Inter', sans-serif");

        // Apply density
        const density = DENSITY_MAP[prefs.layout] ?? 1;
        root.style.setProperty('--density', String(density));

        // Apply theme
        applyTheme(prefs.theme);

        // Apply custom CSS
        let styleEl = document.getElementById('custom-css');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-css';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = prefs.custom_css ?? '';
      },
    }),
    {
      name: 'cc-ui',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
