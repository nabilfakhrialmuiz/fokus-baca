// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../config/firebase";
import { Colors } from "../constants/Colors";

import { useBookStore } from "../store/useBookStore";

export default function LoginScreen() {
  const router = useRouter();

  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const setDarkMode = useBookStore((state) => state.setDarkMode);

  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // FITUR KEMBALI: State untuk toggle mata password
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Harap isi email dan password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      Alert.alert(
        "Login Gagal",
        "Email atau password salah, atau akun tidak ditemukan.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setDarkMode(!isDark);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <TouchableOpacity style={styles.themeToggleBtn} onPress={toggleTheme}>
          <Ionicons
            name={isDark ? "moon" : "sunny"}
            size={28}
            color={theme.text}
          />
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="book" size={48} color={theme.primary} />
          </View>
          <Text style={styles.title}>Selamat Datang</Text>
          <Text style={styles.subtitle}>
            Masuk untuk melanjutkan membaca dan mencapai target harian Anda.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={theme.lightGray}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Alamat Email"
              placeholderTextColor={theme.lightGray}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={theme.lightGray}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Kata Sandi"
              placeholderTextColor={theme.lightGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword} // FITUR KEMBALI
            />
            {/* FITUR KEMBALI: Tombol Toggle Password */}
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={theme.lightGray}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Masuk Akun</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Belum punya akun? </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={styles.footerLink}>Daftar Sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },

    themeToggleBtn: {
      position: "absolute",
      top: 20,
      right: 24,
      zIndex: 10,
      padding: 8,
      backgroundColor: theme.surface,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },

    headerContainer: { alignItems: "center", marginBottom: 40 },
    iconContainer: {
      width: 80,
      height: 80,
      backgroundColor: theme.surface,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    title: {
      fontFamily: "Poppins_700Bold",
      fontSize: 28,
      color: theme.text,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: "Lora_400Regular",
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
      opacity: 0.7,
      lineHeight: 24,
    },

    formContainer: { width: "100%" },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      height: 60,
      borderWidth: 1,
      borderColor: theme.lightGray,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 4,
      elevation: 1,
    },
    inputIcon: { marginRight: 12 },
    input: {
      flex: 1,
      fontFamily: "Poppins_400Regular",
      fontSize: 14,
      color: theme.text,
      paddingVertical: 0,
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    eyeButton: { padding: 4, marginLeft: 8 },

    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 16,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 16,
      color: "#FFF",
    },

    footerContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 32,
    },
    footerText: {
      fontFamily: "Poppins_400Regular",
      fontSize: 14,
      color: theme.text,
      opacity: 0.7,
    },
    footerLink: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 14,
      color: theme.primary,
    },
  });
