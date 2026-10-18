// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import { Colors } from "../../constants/Colors";
import { useBookStore } from "../../store/useBookStore";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);

  // Logika Tema: Jika pengguna mengatur manual, gunakan itu. Jika tidak, ikuti sistem HP.
  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: isDark ? "#888888" : Colors.light.lightGray,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: theme.surface, borderTopColor: theme.lightGray },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Buku Saya",
          tabBarIcon: ({ color }) => (
            <Ionicons name="book" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Statistik",
          tabBarIcon: ({ color }) => (
            <Ionicons name="bar-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Pengaturan",
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    // FIX PADDING ANDROID: Menyamakan dengan bantalan (padding) yang ada di Reader
    height: Platform.OS === "android" ? 90 : 85,
    paddingBottom: Platform.OS === "android" ? 34 : 25,
    paddingTop: Platform.OS === "ios" ? 10 : 15,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderTopWidth: 1,
  },
  tabBarItem: { justifyContent: "center", alignItems: "center" },
  tabBarLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    marginTop: 4,
  },
});
