import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useReminders } from '../hooks/useReminders';
import { clearAuth } from '../lib/auth';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}

function NavItem({ to, icon, label, badge, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium group relative',
          isActive
            ? 'bg-accent/20 text-accent-300 border border-accent/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        )
      }
    >
      <span className='w-5 h-5 flex items-center justify-center shrink-0'>{icon}</span>
      <span className='flex-1'>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className='bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shrink-0'>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const now = new Date();
  const roundedNow = new Date(Math.floor(now.getTime() / (5 * 60_000)) * (5 * 60_000));
  const in7Days = new Date(roundedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: upcomingReminders } = useReminders({ completed: false, due_before: in7Days });
  const overdueCount = upcomingReminders?.filter(
    (r) => new Date(r.due_date) < now
  ).length ?? 0;

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-20 md:hidden'
          onClick={onClose}
          aria-hidden='true'
        />
      )}

      <aside
        className={clsx(
          'fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col z-30 transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className='flex items-center gap-3 px-4 py-5 border-b border-slate-700/50'>
          <div className='w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center'>
            <svg className='w-5 h-5 text-accent-300' fill='currentColor' viewBox='0 0 20 20'>
              <path d='M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z' />
            </svg>
          </div>
          <span className='font-bold text-slate-100 text-lg'>Close Circle</span>
        </div>

        <nav className='flex-1 p-3 space-y-1 overflow-y-auto'>
          <NavItem
            to='/contacts'
            label='Contacts'
            icon={
              <svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-5 h-5'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            }
          />
          <NavItem
            to='/reminders'
            label='Reminders'
            badge={overdueCount}
            icon={
              <svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-5 h-5'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
            }
          />
          <NavItem
            to='/dates'
            label='Important Dates'
            icon={
              <svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-5 h-5'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
              </svg>
            }
          />
          <NavItem
            to='/chat'
            label='AI Assistant'
            icon={
              <svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-5 h-5'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
              </svg>
            }
          />
        </nav>

        <div className='p-3 border-t border-slate-700/50 space-y-1'>
          <NavItem
            to='/settings'
            label='Settings'
            icon={
              <svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-5 h-5'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            }
          />
          <button
            onClick={handleLogout}
            className='flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 w-full text-left'
          >
            <svg className='w-5 h-5 flex items-center justify-center shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
