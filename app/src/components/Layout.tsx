import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { useUIStore } from '../stores/ui';
import { api } from '../lib/api';
import type { User } from '../types';

export function Layout() {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, applyPreferences } = useUIStore();

  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/api/users/me'),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (userData?.preferences) {
      applyPreferences(userData.preferences);
    }
  }, [userData?.preferences, applyPreferences]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700/50">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-slate-100">Close Circle</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
