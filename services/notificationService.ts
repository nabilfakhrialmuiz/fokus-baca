// services/notificationService.ts
// V3 TASK 1: Service module untuk Local Push Notifications (Pengingat Harian)

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Identifier untuk notifikasi pengingat harian agar bisa di-cancel/reschedule
const DAILY_REMINDER_IDENTIFIER = "daily-reading-reminder";

// Channel ID untuk Android 8+ (wajib)
const REMINDER_CHANNEL_ID = "reading-reminder";

/**
 * Mengatur handler agar notifikasi tampil meskipun aplikasi sedang di foreground.
 * Harus dipanggil sekali di awal siklus hidup aplikasi.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Meminta izin notifikasi dari pengguna dan membuat Notification Channel di Android.
 * @returns true jika izin diberikan, false jika ditolak.
 */
export async function registerForNotificationsAsync(): Promise<boolean> {
  // Buat channel di Android terlebih dahulu (wajib sebelum minta permission di Android 13+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Pengingat Membaca",
      description: "Notifikasi pengingat harian untuk membaca buku",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2A9D8F",
    });
  }

  // Cek status izin saat ini
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Minta izin jika belum diberikan
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/**
 * Menjadwalkan notifikasi pengingat harian yang berulang setiap hari.
 * Akan membatalkan pengingat sebelumnya terlebih dahulu untuk menghindari duplikasi.
 *
 * @param hour - Jam pengingat (0-23), default 20
 * @param minute - Menit pengingat (0-59), default 0
 */
export async function scheduleDailyReminder(
  hour: number = 20,
  minute: number = 0,
): Promise<void> {
  // Batalkan pengingat lama terlebih dahulu
  await cancelDailyReminder();

  // Jadwalkan notifikasi harian baru
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_IDENTIFIER,
    content: {
      title: "📖 Fokus Baca",
      body: "Waktunya fokus membaca 15 menit hari ini!",
      sound: true,
      data: { screen: "/(tabs)" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hour,
      minute: minute,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

/**
 * Membatalkan notifikasi pengingat harian yang sudah dijadwalkan.
 */
export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(
    DAILY_REMINDER_IDENTIFIER,
  );
}
