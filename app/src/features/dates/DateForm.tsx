import { useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { DatePickerModal } from '../../components/DatePickerModal';
import { to12hLocalInput } from '../../utils/dates';

interface DateFormProps {
  onSubmit: (data: { contactId: string; title: string; date: string; notes?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  preselectedContactId?: string;
}

export function DateForm({ onSubmit, onCancel, isLoading, preselectedContactId }: DateFormProps) {
  const [title, setTitle] = useState('Birthday');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [contactId, setContactId] = useState(preselectedContactId ?? '');
  const [contactSearch, setContactSearch] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { data: contacts } = useContacts(contactSearch || undefined);
  const selectedContact = contacts?.find((c) => c.id === contactId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;
    onSubmit({ contactId, title, date, notes: notes || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contact picker */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Contact <span className="text-rose-400">*</span>
        </label>
        {contactId && selectedContact ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg">
            <span className="text-slate-100 flex-1">{selectedContact.full_name}</span>
            {!preselectedContactId && (
              <button type="button" onClick={() => setContactId('')} className="text-slate-400 hover:text-slate-200">✕</button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search for a contact..."
              required={!contactId}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {contactSearch && contacts && contacts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {contacts.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setContactId(c.id); setContactSearch(''); }}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-600 text-sm"
                  >
                    {c.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Birthday, Anniversary, etc."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
        <button
          type="button"
          onClick={() => setIsDatePickerOpen(true)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {to12hLocalInput(date) || <span className="text-slate-500">Select a date...</span>}
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes..."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-slate-50">Cancel</button>
        <button
          type="submit"
          disabled={isLoading || !contactId || !date || !title}
          className="px-6 py-2 bg-accent hover:bg-accent-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Add Date'}
        </button>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onConfirm={(v) => setDate(v)}
        initialDate={date}
        title="Select Date"
      />
    </form>
  );
}
