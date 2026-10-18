// app/_layout.tsx
import { Lora_400Regular, Lora_500Medium } from "@expo-google-fonts/lora";
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";

// FASE E3: Import Error Boundary
import { ErrorBoundary } from "../components/ErrorBoundary";

// V3 TASK 1: Import Notification Service & Store
import {
  registerForNotificationsAsync,
  scheduleDailyReminder,
  setupNotificationHandler,
} from "../services/notificationService";
import { useBookStore } from "../store/useBookStore";

// V3 TASK 1: Setup handler di module scope agar notifikasi tampil saat app di foreground
setupNotificationHandler();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Lora_400Regular,
    Lora_500Medium,
  });

  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !fontsLoaded) return;
    const inAuthGroup = segments[0] === "login" || segments[0] === "register";

    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isAuthReady, fontsLoaded, segments]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (isAuthReady) SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isAuthReady]);

  // V3 TASK 1: Inisialisasi notifikasi saat app mulai
  const isReminderEnabled = useBookStore((state) => state.isReminderEnabled);
  const reminderHour = useBookStore((state) => state.reminderHour);
  const reminderMinute = useBookStore((state) => state.reminderMinute);

  useEffect(() => {
    async function initNotifications() {
      const granted = await registerForNotificationsAsync();
      if (granted && isReminderEnabled) {
        await scheduleDailyReminder(reminderHour, reminderMinute);
      }
    }
    initNotifications();
  }, [isReminderEnabled, reminderHour, reminderMinute]);

  if (!fontsLoaded || !isAuthReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* FASE E3: Membungkus seluruh aplikasi dengan Sabuk Pengaman */}
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

