import { useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { LoadingPage } from '../../components/LoadingSpinner';
import { Badge } from '../../components/Badge';
import { DateForm } from './DateForm';
import { ReminderForm } from '../reminders/ReminderForm';
import { useAllDates, useAddImportantDate } from '../../hooks/useDates';
import { useCreateReminder } from '../../hooks/useReminders';
import { toLocalDatetimeInput } from '../../utils/dates';
import { useContactsStore } from '../../stores/contacts';
import type { ImportantDate, Reminder } from '../../types';

// Next occurrence of a monthly-recurring date from today (year rolls forward as needed).
function nextOccurrence(dateStr: string): Date {
  const [, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  next.setHours(9, 0, 0, 0);
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, m - 1, d);
    next.setHours(9, 0, 0, 0);
  }
  return next;
}

// Age a birthday turns on its next occurrence; null if not a birthday or the year isn't in the past.
function turningAge(date: ImportantDate): number | null {
  if (!/birthday/i.test(date.title)) return null;
  const birthYear = Number(date.date.slice(0, 4));
  const age = nextOccurrence(date.date).getFullYear() - birthYear;
  return age >= 1 ? age : null;
}

interface DateRowProps {
  date: ImportantDate;
  onSetReminder: (date: ImportantDate) => void;
}

function DateRow({ date, onSetReminder }: DateRowProps) {
  const isToday = date.days_until === 0;
  const isSoon = (date.days_until ?? 999) <= 7;
  const isUpcoming = (date.days_until ?? 999) <= 30;
  const openContact = useContactsStore((s) => s.openContact);

  // Parse YYYY-MM-DD parts directly — avoids timezone issues with new Date(string)
  const [dYear, dMonth, dDay] = date.date.slice(0, 10).split('-').map(Number);
  const localDate = new Date(dYear, dMonth - 1, dDay);
  const age = turningAge(date);

  return (
    <div className={`group flex items-center gap-3 p-3 sm:gap-4 sm:p-4 rounded-xl border transition-colors ${
      isToday
        ? 'bg-accent/10 border-accent/30'
        : isSoon
        ? 'bg-amber-900/10 border-amber-800/30'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      {/* Date display */}
      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
        isToday ? 'bg-accent text-white' :
        isSoon ? 'bg-amber-800/30 text-amber-300' :
        'bg-slate-700 text-slate-300'
      }`}>
        <span className="text-xs font-semibold uppercase leading-none">
          {format(localDate, 'MMM')}
        </span>
        <span className="text-2xl font-bold leading-none mt-0.5">
          {format(localDate, 'd')}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Mobile: name and title stack so the title can wrap; sm+: single line */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <button
            onClick={() => openContact(date.contact_id)}
            className="self-start max-w-full text-left font-medium text-slate-100 truncate hover:text-accent hover:underline transition-colors"
            title="View contact"
          >
            {date.contact_name}
          </button>
          <span className="hidden sm:inline text-slate-500">—</span>
          <span className="text-slate-300 break-words sm:truncate">
            {date.title}
            {age !== null && <span className="text-slate-500"> · Turning {age}</span>}
          </span>
        </div>
        {date.notes && <p className="text-slate-500 text-sm truncate mt-0.5">{date.notes}</p>}
      </div>

      {/* Hover: set a reminder */}
      <button
        onClick={() => onSetReminder(date)}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10"
        title="Set a reminder for this date"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>

      {/* Days until */}
      <div className="shrink-0">
        {isToday ? (
          <Badge variant="accent" size="md">Today!</Badge>
        ) : (
          <span className={`text-sm font-medium whitespace-nowrap ${isSoon ? 'text-amber-400' : isUpcoming ? 'text-slate-300' : 'text-slate-500'}`}>
            in {date.days_until} days
          </span>
        )}
      </div>
    </div>
  );
}

export function DatesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState<ImportantDate | null>(null);
  const { data, isLoading } = useAllDates(365);
  const addDate = useAddImportantDate();
  const createReminder = useCreateReminder();

  const reminderOpen = reminderDate !== null;

  // Prefill: due 1 day before the next occurrence of this date, at 9am, recurring yearly.
  const reminderPrefill = reminderDate
    ? (() => {
        const next = nextOccurrence(reminderDate.date);
        next.setDate(next.getDate() - 1);
        return {
          title: `Reminder: ${reminderDate.title}${reminderDate.contact_name ? ` (${reminderDate.contact_name})` : ''}`,
          dueDate: toLocalDatetimeInput(next),
        };
      })()
    : null;

  if (isLoading) return <LoadingPage />;

  const upcoming = data?.upcoming ?? [];
  const allDates = data?.all ?? [];

  // Dates beyond upcoming window
  const laterDates = allDates.filter((d) => !upcoming.find((u) => u.id === d.id));

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Important Dates</h1>
          <p className="text-slate-400 text-sm mt-0.5">Birthdays, anniversaries, and more</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Date
        </button>
      </div>

      {allDates.length === 0 ? (
        <EmptyState
          title="No important dates"
          description="Add birthdays, anniversaries, and other dates for your contacts."
          action={
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg text-sm transition-colors"
            >
              Add Date
            </button>
          }
        />
      ) : (
        <>
          {/* Upcoming section (next 90 days) */}
          {upcoming.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Coming Up (Next 90 days)
              </h2>
              <div className="space-y-2">
                {upcoming.map((d) => <DateRow key={d.id} date={d} onSetReminder={setReminderDate} />)}
              </div>
            </div>
          )}

          {/* All other dates */}
          {laterDates.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                All Dates
              </h2>
              <div className="space-y-2">
                {laterDates.map((d) => <DateRow key={d.id} date={d} onSetReminder={setReminderDate} />)}
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Important Date">
        <DateForm
          onSubmit={async (data) => {
            await addDate.mutateAsync(data);
            setIsAddOpen(false);
          }}
          onCancel={() => setIsAddOpen(false)}
          isLoading={addDate.isPending}
        />
      </Modal>

      <Modal
        isOpen={reminderOpen}
        onClose={() => setReminderDate(null)}
        title="New Reminder"
      >
        {reminderDate && reminderPrefill && (
          <ReminderForm
            onSubmit={async (form) => {
              if (!form.title || !form.due_date) return;
              await createReminder.mutateAsync({
                title: form.title,
                notes: form.notes,
                due_date: form.due_date,
                contact_id: form.contact_id ?? reminderDate.contact_id,
                recurrence_days: form.recurrence_days,
                recurrence_annual: form.recurrence_annual,
              });
              setReminderDate(null);
            }}
            onCancel={() => setReminderDate(null)}
            isLoading={createReminder.isPending}
            preselectedContactId={reminderDate.contact_id}
            initial={{
              title: reminderPrefill.title,
              due_date: reminderPrefill.dueDate,
              contact_id: reminderDate.contact_id,
              recurrence_annual: true,
            } as Partial<Reminder>}
          />
        )}
      </Modal>
    </div>
  );
}
