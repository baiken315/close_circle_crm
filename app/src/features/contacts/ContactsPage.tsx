import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { ContactCard } from '../../components/ContactCard';
import { ContactDetail } from './ContactDetail';
import { ContactForm } from './ContactForm';
import { BulkActionsBar } from './BulkActionsBar';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import { useContacts, useCreateContact } from '../../hooks/useContacts';
import { useContactsStore, type SortBy } from '../../stores/contacts';
import type { Contact } from '../../types';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'group', label: 'Group' },
  { value: 'date_added', label: 'Date Added' },
  { value: 'most_active', label: 'Most Active' },
];

function sortContacts(contacts: Contact[], sortBy: SortBy): Contact[] {
  const sorted = [...contacts];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    case 'group':
      return sorted.sort((a, b) => {
        const ga = (a.groups?.[0] ?? '').toLowerCase();
        const gb = (b.groups?.[0] ?? '').toLowerCase();
        if (ga === gb) return a.full_name.localeCompare(b.full_name);
        if (!ga) return 1;
        if (!gb) return -1;
        return ga.localeCompare(gb);
      });
    case 'date_added':
      return sorted.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case 'most_active':
      return sorted.sort((a, b) => {
        const ca = a.interaction_count ?? 0;
        const cb = b.interaction_count ?? 0;
        if (ca === cb) return a.full_name.localeCompare(b.full_name);
        return cb - ca;
      });
    default:
      return sorted;
  }
}

export function ContactsPage() {
  const {
    searchQuery, setSearchQuery,
    selectedContactId, setSelectedContactId,
    activeGroups, toggleGroup, clearGroups,
    sortBy, setSortBy,
    selectedIds, toggleSelected, selectAll, clearSelection,
  } = useContactsStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: contacts, isLoading } = useContacts(debouncedSearch || undefined);
  const createContact = useCreateContact();

  const allGroups = useMemo(() => {
    const groupSet = new Set<string>();
    contacts?.forEach((contact) => {
      contact.groups?.forEach((group) => groupSet.add(group));
    });
    return Array.from(groupSet).sort();
  }, [contacts]);

  const displayContacts = useMemo(() => {
    if (!contacts) return [];
    let filtered = contacts;
    if (activeGroups.size > 0) {
      filtered = contacts.filter((c) =>
        c.groups?.some((g) => activeGroups.has(g))
      );
    }
    if (!showPrivate) {
      filtered = filtered.filter((c) => !c.is_private);
    }
    return sortContacts(filtered, sortBy);
  }, [contacts, activeGroups, sortBy, showPrivate]);

  const hasActiveFilters = activeGroups.size > 0;
  const isSelecting = selectedIds.size > 0;
  const allDisplaySelected = displayContacts.length > 0 && displayContacts.every((c) => selectedIds.has(c.id));

  useEffect(() => () => clearSelection(), []);

  return (
    <div className="flex h-full">
      {/* Left: Contact list */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-700/50 shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-100">
              Contacts
              {contacts && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({displayContacts.length}{displayContacts.length !== contacts.length ? `/${contacts.length}` : ''})
                </span>
              )}
            </h1>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>

          {/* Search + Sort row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-300 text-sm hover:bg-slate-700 transition-colors shrink-0"
                title="Sort"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span>
              </button>
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setIsSortOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          sortBy === opt.value
                            ? 'bg-accent/20 text-accent-200'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Active group filters + show private toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasActiveFilters && (
              <>
                <span className="text-xs text-slate-500">Filtered by:</span>
                {Array.from(activeGroups).map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGroup(g)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent/30 text-accent-200 ring-1 ring-accent/60 hover:bg-accent/40 transition-colors"
                  >
                    {g}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={clearGroups}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
                >
                  Clear all
                </button>
              </>
            )}
            {!hasActiveFilters && (
              <button
                onClick={() => setShowPrivate((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  showPrivate
                    ? 'bg-amber-900/30 text-amber-300 ring-1 ring-amber-700/60'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPrivate ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
                {showPrivate ? 'Show Private' : 'Private'}
              </button>
            )}
          </div>

          {/* Bulk actions bar */}
          {isSelecting && contacts && (
            <BulkActionsBar
              selectedIds={selectedIds}
              contacts={contacts}
              onClear={clearSelection}
              onSelectAll={() => selectAll(displayContacts.map((c) => c.id))}
              allSelected={allDisplaySelected}
              allGroups={allGroups}
            />
          )}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : !displayContacts || displayContacts.length === 0 ? (
            <EmptyState
              title={searchQuery || hasActiveFilters ? 'No contacts found' : 'No contacts yet'}
              description={
                searchQuery
                  ? `No results for "${searchQuery}"`
                  : hasActiveFilters
                  ? 'No contacts match the selected groups'
                  : 'Add your first contact to get started'
              }
              action={
                !searchQuery && !hasActiveFilters ? (
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="px-4 py-2 bg-accent hover:bg-accent-400 text-white rounded-lg text-sm transition-colors"
                  >
                    Add Contact
                  </button>
                ) : hasActiveFilters ? (
                  <button
                    onClick={clearGroups}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
                  >
                    Clear Filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-0.5">
              {displayContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  isSelected={!isSelecting && contact.id === selectedContactId}
                  isChecked={selectedIds.has(contact.id)}
                  isSelecting={isSelecting}
                  onCheck={toggleSelected}
                  activeGroups={activeGroups}
                  onGroupClick={toggleGroup}
                  onClick={() => setSelectedContactId(
                    contact.id === selectedContactId ? null : contact.id
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Contact detail */}
      <div className="flex-1 overflow-hidden hidden md:flex">
        {selectedContactId && !isSelecting ? (
          <div className="h-full overflow-y-auto w-full">
            <ContactDetail
              contactId={selectedContactId}
              onClose={() => setSelectedContactId(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">
                {isSelecting ? 'Use the actions bar above to apply bulk changes' : 'Select a contact to view details'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Contact detail as full-screen overlay */}
      {selectedContactId && !isSelecting && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900 overflow-y-auto">
          <ContactDetail
            contactId={selectedContactId}
            onClose={() => setSelectedContactId(null)}
          />
        </div>
      )}

      {/* Create Contact Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Contact" size="lg">
        <ContactForm
          onSubmit={async (data) => {
            const created = await createContact.mutateAsync(data);
            setIsCreateOpen(false);
            setSelectedContactId(created.id);
          }}
          onCancel={() => setIsCreateOpen(false)}
          isLoading={createContact.isPending}
          allGroups={allGroups}
        />
      </Modal>
    </div>
  );
}
