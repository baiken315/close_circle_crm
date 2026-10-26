import { useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { toLocalDatetimeInput, to12hLocalInput } from '../../utils/dates';
import { DatePickerModal } from '../../components/DatePickerModal';
import type { Reminder } from '../../types';

interface ReminderFormProps {
  initial?: Partial<Reminder>;
  onSubmit: (data: Partial<Reminder>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  preselectedContactId?: string;
  initialRecurrence?: Partial<Pick<Reminder, 'recurrence_days' | 'recurrence_annual'>>;
}

export function ReminderForm({ initial, onSubmit, onCancel, isLoading, preselectedContactId, initialRecurrence }: ReminderFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [dueDate, setDueDate] = useState(() => {
    if (initial?.due_date) {
      return toLocalDatetimeInput(new Date(initial.due_date));
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return toLocalDatetimeInput(tomorrow);
  });
  const [contactId, setContactId] = useState(initial?.contact_id ?? preselectedContactId ?? '');
  const [recurrenceDays, setRecurrenceDays] = useState(
    (initial?.recurrence_days ?? initialRecurrence?.recurrence_days)?.toString() ?? ''
  );
  const [recurrenceAnnual, setRecurrenceAnnual] = useState(
    Boolean(initial?.recurrence_annual ?? initialRecurrence?.recurrence_annual)
  );
  const [contactSearch, setContactSearch] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { data: contacts } = useContacts(contactSearch || undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueDateISO = new Date(dueDate).toISOString();
    onSubmit({
      title,
      notes: notes || undefined,
      due_date: dueDateISO,
      contact_id: contactId || undefined,
      recurrence_days: recurrenceAnnual ? undefined : recurrenceDays ? parseInt(recurrenceDays, 10) : undefined,
      recurrence_annual: recurrenceAnnual,
    });
  };

  const selectedContact = contacts?.find((c) => c.id === contactId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Title <span className="text-rose-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="What do you need to do?"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Due Date & Time <span className="text-rose-400">*</span>
        </label>
        <button
          type="button"
          onClick={() => setIsDatePickerOpen(true)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {to12hLocalInput(dueDate) || <span className="text-slate-500">Select date & time...</span>}
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Linked Contact <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        {contactId && selectedContact ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg">
            <span className="text-slate-100 flex-1">{selectedContact.full_name}</span>
            <button
              type="button"
              onClick={() => setContactId('')}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search for a contact..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {contactSearch && contacts && contacts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {contacts.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setContactId(c.id);
                      setContactSearch('');
                    }}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-600 text-sm"
                  >
                    {c.full_name}
                    {c.organization && <span className="text-slate-400 ml-1">— {c.organization}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Additional context..."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Recurrence <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          type="number"
          value={recurrenceDays}
          disabled={recurrenceAnnual}
          onChange={(e) => setRecurrenceDays(e.target.value)}
          placeholder="e.g., 7 for weekly, 30 for monthly"
          min="1"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => {
            setRecurrenceAnnual((prev) => {
              const next = !prev;
              if (next) setRecurrenceDays('');
              return next;
            });
          }}
          className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            recurrenceAnnual
              ? 'bg-accent/20 border-accent/40 text-accent'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:text-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {recurrenceAnnual ? 'Repeats every year' : 'Repeat every year'}
        </button>
        {recurrenceAnnual && (
          <p className="text-xs text-slate-500 mt-1.5">Same month &amp; day each year (leap-year safe).</p>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-slate-300 hover:text-slate-50 hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="px-6 py-2 bg-accent hover:bg-accent-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : initial?.id ? 'Update Reminder' : 'Create Reminder'}
        </button>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onConfirm={(v) => setDueDate(v)}
        initialDate={dueDate}
        withTime
        title="Select Due Date & Time"
      />
    </form>
  );
}
