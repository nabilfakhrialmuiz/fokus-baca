// store/useBookStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ActiveBook {
  id: string;
  title: string;
  uri: string;
  hasCover: string;
}

interface BookState {
  activeBook: ActiveBook | null;
  setActiveBook: (book: ActiveBook | null) => void;
  // FASE BARU: State untuk Tema Manual (null berarti mengikuti sistem HP)
  isDarkMode: boolean | null;
  setDarkMode: (isDark: boolean | null) => void;
  // V3 TASK 1: State untuk Pengingat Harian (Notifikasi Lokal)
  isReminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (hour: number, minute: number) => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      activeBook: null,
      setActiveBook: (book) => set({ activeBook: book }),
      isDarkMode: null,
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      // V3 TASK 1: Default pengingat aktif jam 20:00
      isReminderEnabled: true,
      reminderHour: 20,
      reminderMinute: 0,
      setReminderEnabled: (enabled) => set({ isReminderEnabled: enabled }),
      setReminderTime: (hour, minute) =>
        set({ reminderHour: hour, reminderMinute: minute }),
    }),
    {
      name: "fokus-baca-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
