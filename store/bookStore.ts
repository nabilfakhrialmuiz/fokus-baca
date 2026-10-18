// store/bookStore.ts
import { create } from "zustand";

interface BookState {
  activeBook: {
    id?: string;
    title?: string;
    uri?: string;
    hasCover?: string;
  } | null;
  setActiveBook: (book: any) => void;
  clearActiveBook: () => void;
}

// E1: State Manager Global untuk menampung data buku antar layar
export const useBookStore = create<BookState>((set) => ({
  activeBook: null,
  setActiveBook: (book) => set({ activeBook: book }),
  clearActiveBook: () => set({ activeBook: null }),
}));
