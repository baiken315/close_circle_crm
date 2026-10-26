import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),
    }),
    { name: 'cc-chat' }
  )
);
