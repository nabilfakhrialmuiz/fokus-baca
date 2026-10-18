// components/ErrorBoundary.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { ErrorInfo, ReactNode } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../constants/Colors";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Memperbarui state agar render berikutnya menampilkan fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Di aplikasi nyata, Anda bisa mengirim error ini ke layanan analitik (misal: Sentry)
    console.error("Terjadi Crash Aplikasi:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="warning" size={80} color="#E76F51" />
            <Text style={styles.title}>Ups! Terjadi Kendala</Text>
            <Text style={styles.subtitle}>
              Sistem kami mendeteksi masalah teknis pada halaman ini. Jangan
              khawatir, data Anda aman.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => this.setState({ hasError: false })}
            >
              <Text style={styles.buttonText}>Muat Ulang Layar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 32,
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    margin: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Lora_400Regular",
    fontSize: 16,
    color: Colors.light.text,
    textAlign: "center",
    opacity: 0.8,
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.surface,
    fontSize: 16,
  },
});
