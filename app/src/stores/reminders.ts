import { create } from 'zustand';

interface RemindersState {
  showCompleted: boolean;
  filterContactId: string | null;
  setShowCompleted: (show: boolean) => void;
  setFilterContactId: (id: string | null) => void;
}

export const useRemindersStore = create<RemindersState>()((set) => ({
  showCompleted: false,
  filterContactId: null,
  setShowCompleted: (show) => set({ showCompleted: show }),
  setFilterContactId: (id) => set({ filterContactId: id }),
}));
