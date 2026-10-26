import { useState } from 'react';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { LoadingPage } from '../../components/LoadingSpinner';
import { Badge } from '../../components/Badge';
import { ReminderForm } from './ReminderForm';
import { useReminders, useCreateReminder, useCompleteReminder, useUpdateReminder, useDeleteReminder } from '../../hooks/useReminders';
import type { Reminder } from '../../types';

function ReminderRow({
  reminder,
  onComplete,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onComplete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = !reminder.completed && isPast(new Date(reminder.due_date));

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
      reminder.completed
        ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
        : isOverdue
        ? 'bg-rose-900/10 border-rose-800/30'
        : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600/50'
    }`}>
      {!reminder.completed && (
        <button
          onClick={() => onComplete(reminder.id)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            isOverdue ? 'border-rose-500 hover:bg-rose-500' : 'border-slate-500 hover:border-accent hover:bg-accent/20'
          }`}
          title="Mark complete"
        >
          <svg className="w-3 h-3 opacity-0 hover:opacity-100 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      {reminder.completed && (
        <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500 shrink-0 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className={`font-medium text-sm ${reminder.completed ? 'line-through text-slate-400' : 'text-slate-100'}`}>
            {reminder.title}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {reminder.recurrence_days && (
              <Badge size="sm" variant="accent">↻ {reminder.recurrence_days}d</Badge>
            )}
            <span className={`text-xs ${isOverdue ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
              {reminder.completed
                ? reminder.completed_at ? `Done ${formatDistanceToNow(new Date(reminder.completed_at), { addSuffix: true })}` : 'Done'
                : isOverdue
                ? `Overdue ${formatDistanceToNow(new Date(reminder.due_date), { addSuffix: true })}`
                : format(new Date(reminder.due_date), 'MMM d, h:mm a')}
            </span>
            {!reminder.completed && (
              <button
                onClick={() => onEdit(reminder)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Edit reminder"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(reminder.id)}
              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
              title="Delete reminder"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        {reminder.contact_name && (
          <p className="text-xs text-slate-400 mt-0.5">
            <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {reminder.contact_name}
          </p>
        )}
        {reminder.notes && (
          <p className="text-xs text-slate-500 mt-1 truncate">{reminder.notes}</p>
        )}
      </div>
    </div>
  );
}

export function RemindersPage() {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const { data: activeReminders, isLoading } = useReminders({ completed: false });
  const { data: completedReminders } = useReminders({ completed: true });
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const overdue = activeReminders?.filter((r) => isPast(new Date(r.due_date))) ?? [];
  const upcoming = activeReminders?.filter((r) => !isPast(new Date(r.due_date))) ?? [];

  // Only show completed from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCompleted = completedReminders?.filter(
    (r) => r.completed_at && new Date(r.completed_at) >= thirtyDaysAgo
  ) ?? [];

  if (isLoading) return <LoadingPage />;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reminders</h1>
          {overdue.length > 0 && (
            <p className="text-rose-400 text-sm mt-0.5">
              {overdue.length} overdue reminder{overdue.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Reminder
        </button>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3">Overdue</h2>
          <div className="space-y-2">
            {overdue.map((r) => (
              <ReminderRow key={r.id} reminder={r} onComplete={(id) => void completeReminder.mutateAsync(id)} onEdit={setEditingReminder} onDelete={(id) => void deleteReminder.mutateAsync(id)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
        </h2>
        {upcoming.length === 0 && overdue.length === 0 ? (
          <EmptyState
            title="No reminders"
            description="You're all caught up! Create a reminder to stay on track."
            action={
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg text-sm transition-colors"
              >
                Create Reminder
              </button>
            }
          />
        ) : upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No upcoming reminders.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderRow key={r.id} reminder={r} onComplete={(id) => void completeReminder.mutateAsync(id)} onEdit={setEditingReminder} onDelete={(id) => void deleteReminder.mutateAsync(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      <div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 hover:text-slate-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Recently Completed ({recentCompleted.length})
        </button>
        {showCompleted && recentCompleted.length > 0 && (
          <div className="space-y-2">
            {recentCompleted.map((r) => (
              <ReminderRow key={r.id} reminder={r} onComplete={() => {}} onEdit={() => {}} onDelete={(id) => void deleteReminder.mutateAsync(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Create Reminder Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Reminder">
        <ReminderForm
          onSubmit={async (data) => {
            await createReminder.mutateAsync(data as Parameters<typeof createReminder.mutateAsync>[0]);
            setIsCreateOpen(false);
          }}
          onCancel={() => setIsCreateOpen(false)}
          isLoading={createReminder.isPending}
        />
      </Modal>

      {/* Edit Reminder Modal */}
      <Modal isOpen={!!editingReminder} onClose={() => setEditingReminder(null)} title="Edit Reminder">
        {editingReminder && (
          <ReminderForm
            initial={editingReminder}
            onSubmit={async (data) => {
              await updateReminder.mutateAsync({ id: editingReminder.id, ...data });
              setEditingReminder(null);
            }}
            onCancel={() => setEditingReminder(null)}
            isLoading={updateReminder.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
