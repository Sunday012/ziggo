import { create } from 'zustand'

interface CommentState {
    chatClicked: boolean;
    isOpen: () => void;
    isClosed: () => void;
  }

const useStore = create<CommentState>((set) => ({
  chatClicked: false,
  isOpen: () => set((state) => ({ chatClicked: true })),
  isClosed: () => set({ chatClicked: false }),
}));

export default useStore;