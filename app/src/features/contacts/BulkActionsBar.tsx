import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { SearchSelect } from '../../components/SearchSelect';
import { ShareExportModal } from '../../components/ShareExportModal';
import { useUpdateContact } from '../../hooks/useContacts';
import { useLogInteraction } from '../../hooks/useInteractions';
import { toLocalDatetimeInput, to12hLocalInput } from '../../utils/dates';
import { DatePickerModal } from '../../components/DatePickerModal';
import type { Contact } from '../../types';

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  contacts: Contact[];
  onClear: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  allGroups?: string[];
}

type BulkModal = 'privacy' | 'group' | 'interaction' | 'export' | null;

export function BulkActionsBar({ selectedIds, contacts, onClear, onSelectAll, allSelected, allGroups }: BulkActionsBarProps) {
  const [openModal, setOpenModal] = useState<BulkModal>(null);
  const updateContact = useUpdateContact();
  const logInteraction = useLogInteraction();

  const count = selectedIds.size;
  const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));

  const allPrivate = selectedContacts.every((c) => c.is_private);
  const allShared = selectedContacts.every((c) => !c.is_private);

  async function handleMarkPrivacy(isPrivate: boolean) {
    for (const c of selectedContacts) {
      await updateContact.mutateAsync({ id: c.id, is_private: isPrivate });
    }
    setOpenModal(null);
    onClear();
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-accent/30 rounded-lg">
        <button
          onClick={allSelected ? onClear : onSelectAll}
          className="flex items-center gap-1.5 text-sm font-medium text-accent-300 hover:text-accent-200 transition-colors"
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            allSelected ? 'bg-accent border-accent' : 'border-slate-500 hover:border-accent'
          }`}>
            {allSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span>{count} selected</span>
        </button>

        <div className="h-4 w-px bg-slate-600 mx-1" />

        <div className="flex items-center gap-1 flex-1 flex-wrap">
          <ActionButton onClick={() => setOpenModal('privacy')} icon="lock">
            {allPrivate ? 'Make Shared' : allShared ? 'Make Private' : 'Set Privacy'}
          </ActionButton>
          <ActionButton onClick={() => setOpenModal('group')} icon="tag">
            Add to Group
          </ActionButton>
          <ActionButton onClick={() => setOpenModal('interaction')} icon="chat">
            Log Interaction
          </ActionButton>
          <ActionButton onClick={() => setOpenModal('export')} icon="share">
            Share/Export
          </ActionButton>
        </div>

        <button
          onClick={onClear}
          className="text-slate-500 hover:text-slate-300 transition-colors ml-auto shrink-0"
          title="Clear selection"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <Modal isOpen={openModal === 'privacy'} onClose={() => setOpenModal(null)} title="Set Privacy">
        <PrivacyModal
          count={count}
          allPrivate={allPrivate}
          allShared={allShared}
          isLoading={updateContact.isPending}
          onConfirm={handleMarkPrivacy}
          onCancel={() => setOpenModal(null)}
        />
      </Modal>

      <Modal isOpen={openModal === 'group'} onClose={() => setOpenModal(null)} title="Add to Group">
        <GroupModal
          count={count}
          selectedContacts={selectedContacts}
          allGroups={allGroups || []}
          isLoading={updateContact.isPending}
          onConfirm={async (groups) => {
            for (const c of selectedContacts) {
              const existing = c.groups ?? [];
              const newGroups = [...new Set([...existing, ...groups])];
              await updateContact.mutateAsync({ id: c.id, groups: newGroups });
            }
            setOpenModal(null);
            onClear();
          }}
          onCancel={() => setOpenModal(null)}
        />
      </Modal>

      <Modal isOpen={openModal === 'interaction'} onClose={() => setOpenModal(null)} title="Log Interaction">
        <BulkInteractionModal
          count={count}
          isLoading={logInteraction.isPending}
          onConfirm={async ({ type, date, notes }) => {
            const isoDate = new Date(date).toISOString();
            for (const c of selectedContacts) {
              await logInteraction.mutateAsync({ contactId: c.id, type, date: isoDate, notes });
            }
            setOpenModal(null);
            onClear();
          }}
          onCancel={() => setOpenModal(null)}
        />
      </Modal>

      <ShareExportModal
        isOpen={openModal === 'export'}
        onClose={() => setOpenModal(null)}
        contacts={selectedContacts}
      />
    </>
  );
}

const ICON_PATHS = {
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
  chat: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
};

function ActionButton({ onClick, icon, children }: {
  onClick: () => void;
  icon: 'lock' | 'tag' | 'chat' | 'share';
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS[icon]} />
      </svg>
      {children}
    </button>
  );
}

function PrivacyModal({ count, allPrivate, allShared, isLoading, onConfirm, onCancel }: {
  count: number;
  allPrivate: boolean;
  allShared: boolean;
  isLoading: boolean;
  onConfirm: (isPrivate: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        {allPrivate
          ? `All ${count} selected contacts are private. Make them shared (visible to all household users)?`
          : allShared
          ? `Make ${count} selected contact${count === 1 ? '' : 's'} private (visible only to you)?`
          : `${count} contacts with mixed privacy selected. Choose an action:`}
      </p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm">
          Cancel
        </button>
        {!allShared && (
          <button
            onClick={() => onConfirm(false)}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Make Shared
          </button>
        )}
        {!allPrivate && (
          <button
            onClick={() => onConfirm(true)}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Make Private'}
          </button>
        )}
      </div>
    </div>
  );
}

function GroupModal({ count, selectedContacts, allGroups, isLoading, onConfirm, onCancel }: {
  count: number;
  selectedContacts: Contact[];
  allGroups: string[];
  isLoading: boolean;
  onConfirm: (groups: string[]) => void;
  onCancel: () => void;
}) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  

  const existingGroups = Array.from(
    new Set(selectedContacts.flatMap((c) => c.groups ?? []))
  ).sort();

  const allOptions = [...new Set([...existingGroups, ...allGroups])].sort();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Add {count} contact{count === 1 ? '' : 's'} to one or more groups. Contacts already in a group will not be duplicated.
      </p>

      <SearchSelect
        id="bulk-group-select"
        label="Select groups"
        placeholder="Select or type to create..."
        value={selectedGroups}
        onChange={setSelectedGroups}
        options={allOptions}
        allowCustom={true}
        multiple={true}
      />

      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(selectedGroups)}
          disabled={selectedGroups.length === 0 || isLoading}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : `Add to ${selectedGroups.length} group${selectedGroups.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

const INTERACTION_TYPES = ['meeting', 'call', 'email', 'text', 'social', 'other'] as const;
type InteractionType = typeof INTERACTION_TYPES[number];

function BulkInteractionModal({ count, isLoading, onConfirm, onCancel }: {
  count: number;
  isLoading: boolean;
  onConfirm: (data: { type: InteractionType; date: string; notes?: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<InteractionType>('meeting');
  const [date, setDate] = useState(() => toLocalDatetimeInput());
  const [notes, setNotes] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Log the same interaction for {count} contact{count === 1 ? '' : 's'} simultaneously.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InteractionType)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {INTERACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Date & Time</label>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {to12hLocalInput(date) || <span className="text-slate-500">Select date & time...</span>}
            <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Notes <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm">
          Cancel
        </button>
        <button
          onClick={() => onConfirm({ type, date, notes: notes || undefined })}
          disabled={isLoading || !date}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Logging...' : `Log for ${count} contact${count === 1 ? '' : 's'}`}
        </button>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onConfirm={(v) => setDate(v)}
        initialDate={date}
        withTime
        title="Select Date & Time"
      />
    </div>
  );
}
