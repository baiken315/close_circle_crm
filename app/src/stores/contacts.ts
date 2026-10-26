import { create } from 'zustand';

export type SortBy = 'name' | 'group' | 'date_added' | 'most_active';

interface ContactsState {
  selectedContactId: string | null;
  searchQuery: string;
  activeGroups: Set<string>;
  sortBy: SortBy;
  // Bulk selection
  selectedIds: Set<string>;
  setSelectedContactId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleGroup: (group: string) => void;
  clearGroups: () => void;
  setSortBy: (sort: SortBy) => void;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  // Navigate to the Contacts page and open this contact's detail panel.
  // (Contact detail is store-driven, not a route, so other pages call this.)
  openContact: (id: string) => void;
}

export const useContactsStore = create<ContactsState>()((set) => ({
  selectedContactId: null,
  searchQuery: '',
  activeGroups: new Set(),
  sortBy: 'name',
  selectedIds: new Set(),
  setSelectedContactId: (id) => set({ selectedContactId: id }),
  openContact: (id) => {
    set({ selectedContactId: id });
    window.history.pushState({}, '', '/contacts');
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleGroup: (group) =>
    set((state) => {
      const next = new Set(state.activeGroups);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return { activeGroups: next };
    }),
  clearGroups: () => set({ activeGroups: new Set() }),
  setSortBy: (sort) => set({ sortBy: sort }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
