import { useState } from 'react';
import type { Contact, ContactMethod } from '../../types';
import { SearchSelect } from '../../components/SearchSelect';
import { DatePickerModal } from '../../components/DatePickerModal';
import { to12hLocalInput } from '../../utils/dates';
// ContactMethodDraft is a draft without the contact_id (assigned on save) and with optional id
type ContactMethodDraft = Omit<ContactMethod, 'contact_id' | 'id'> & { id?: string };

interface ContactFormProps {
  initial?: Partial<Contact>;
  onSubmit: (data: Partial<Contact>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  allGroups?: string[];
  beforeActions?: React.ReactNode;
}


export function ContactForm({ initial, onSubmit, onCancel, isLoading, allGroups = [], beforeActions }: ContactFormProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dateOfBirth, setDateOfBirth] = useState((initial?.date_of_birth ?? '').slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [groups, setGroups] = useState<string[]>(initial?.groups ?? []);
  const [factoidsInput, setFactoidsInput] = useState((initial?.factoids ?? []).join('\n'));
  const [methods, setMethods] = useState<ContactMethodDraft[]>(
    initial?.contact_methods?.map((m) => ({ ...m })) ?? []
  );
  const [isPrivate, setIsPrivate] = useState(initial?.is_private ?? false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const addMethod = () => {
    setMethods((prev) => [...prev, { type: 'email', value: '', is_primary: false }]);
  };

  const updateMethod = (idx: number, update: Partial<ContactMethodDraft>) => {
    setMethods((prev) => prev.map((m, i) => (i === idx ? { ...m, ...update } : m)));
  };

  const removeMethod = (idx: number) => {
    setMethods((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const factoids = factoidsInput
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    onSubmit({
      full_name: fullName,
      nickname: nickname || undefined,
      organization: organization || undefined,
      title: title || undefined,
      date_of_birth: dateOfBirth || null,
      notes: notes || undefined,
      is_private: isPrivate,
      groups,
      factoids,
      contact_methods: methods.filter((m) => m.value.trim()) as Contact['contact_methods'],
    });
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Full Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jane Smith"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Jane"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Date of Birth</label>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {to12hLocalInput(dateOfBirth) || <span className="text-slate-500">Select date of birth...</span>}
            <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Organization</label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="CEO"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Groups */}
      <SearchSelect
        id="groups"
        label="Groups"
        placeholder="Select or type to create..."
        value={groups}
        onChange={setGroups}
        options={allGroups}
        allowCustom={true}
        multiple={true}
      />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any additional context about this person..."
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />
      </div>

      {/* Factoids */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Factoids <span className="text-slate-500 font-normal">(one per line)</span>
        </label>
        <textarea
          value={factoidsInput}
          onChange={(e) => setFactoidsInput(e.target.value)}
          rows={3}
          placeholder="Loves hiking&#10;Has two dogs&#10;Went to MIT"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none font-mono text-sm"
        />
      </div>

      {/* Contact Methods */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">Contact Methods</label>
          <button
            type="button"
            onClick={addMethod}
            className="text-xs text-accent-300 hover:text-accent transition-colors"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {methods.map((method, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <select
                value={method.type}
                onChange={(e) => updateMethod(idx, { type: e.target.value as ContactMethod['type'] })}
                className="px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="address">Address</option>
                <option value="social">Social</option>
              </select>
              {method.type === 'social' && (
                <input
                  type="text"
                  value={method.label ?? ''}
                  onChange={(e) => updateMethod(idx, { label: e.target.value })}
                  placeholder="Platform"
                  className="w-24 px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              )}
              <input
                type="text"
                value={method.value}
                onChange={(e) => updateMethod(idx, { value: e.target.value })}
                placeholder={
                  method.type === 'email' ? 'email@example.com' :
                  method.type === 'phone' ? '+1 (555) 000-0000' :
                  method.type === 'address' ? '123 Main St...' :
                  'Username or URL'
                }
                className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <label className="flex items-center gap-1 text-xs text-slate-400 py-2">
                <input
                  type="checkbox"
                  checked={method.is_primary}
                  onChange={(e) => updateMethod(idx, { is_primary: e.target.checked })}
                  className="accent-accent"
                />
                Primary
              </label>
              <button
                type="button"
                onClick={() => removeMethod(idx)}
                className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {methods.length === 0 && (
            <p className="text-slate-500 text-sm italic">No contact methods yet. Click + Add to add one.</p>
          )}
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center justify-between py-3 px-4 bg-slate-700/40 rounded-lg border border-slate-600/50">
        <div>
          <div className="text-sm font-medium text-slate-200">Private contact</div>
          <div className="text-xs text-slate-500 mt-0.5">Only visible to you. Shared contacts are visible to all household users.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => setIsPrivate((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 ${
            isPrivate ? 'bg-accent' : 'bg-slate-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
              isPrivate ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {beforeActions}

      {/* Actions */}
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
          disabled={isLoading || !fullName.trim()}
          className="px-6 py-2 bg-accent hover:bg-accent-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : initial?.id ? 'Update Contact' : 'Create Contact'}
        </button>
      </div>
    </form>
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onConfirm={(v) => setDateOfBirth(v)}
        initialDate={dateOfBirth}
        title="Select Date of Birth"
      />
    </>
  );
}
