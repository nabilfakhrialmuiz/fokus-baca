// components/ShareQuoteModal.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { Colors } from "../constants/Colors";
import { useBookStore } from "../store/useBookStore";

interface ShareQuoteModalProps {
  isVisible: boolean;
  onClose: () => void;
  quoteText: string;
  bookTitle: string;
}

export function ShareQuoteModal({
  isVisible,
  onClose,
  quoteText,
  bookTitle,
}: ShareQuoteModalProps) {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const viewShotRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!viewShotRef.current?.capture) return;

    try {
      setIsSharing(true);
      // Render Card menjadi gambar (URI sementara)
      const uri = await viewShotRef.current.capture();

      // Panggil expo-sharing untuk membuka share dialog bawaan OS
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: "Bagikan kutipan dari " + bookTitle,
          mimeType: "image/png",
          UTI: "public.png", // Untuk iOS
        });
      }
    } catch (error) {
      console.log("Error sharing quote:", error);
    } finally {
      setIsSharing(false);
      onClose(); // Tutup modal setelah selesai membagikan
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bagikan Kutipan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Area yang akan di-screenshot (ViewShot) */}
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1.0 }}
            style={styles.cardWrapper}
          >
            <View style={styles.quoteCard}>
              <Ionicons
                name="chatbubble-ellipses"
                size={32}
                color={theme.primary}
                style={styles.quoteIcon}
              />
              <Text style={styles.quoteText}>"{quoteText}"</Text>
              
              <View style={styles.cardFooter}>
                <View style={styles.divider} />
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {bookTitle}
                </Text>
                <Text style={styles.brandText}>• Fokus Baca App</Text>
              </View>
            </View>
          </ViewShot>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name="share-social"
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.shareButtonText}>Bagikan ke Sosmed</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContainer: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 20,
      color: theme.text,
    },
    closeBtn: {
      padding: 4,
    },
    cardWrapper: {
      backgroundColor: theme.surface, // Penting agar gambar tidak transparan di background
    },
    quoteCard: {
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 24,
      paddingTop: 32,
      borderWidth: 1,
      borderColor: theme.lightGray,
      // Efek glassmorphism / card premium
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 2,
      position: "relative",
    },
    quoteIcon: {
      position: "absolute",
      top: 16,
      left: 16,
      opacity: 0.2,
    },
    quoteText: {
      fontFamily: "Lora_500Medium",
      fontSize: 18,
      color: theme.text,
      lineHeight: 28,
      textAlign: "left",
      marginTop: 12,
      marginBottom: 24,
    },
    cardFooter: {
      marginTop: "auto",
    },
    divider: {
      height: 2,
      backgroundColor: theme.primary,
      width: 40,
      marginBottom: 12,
      opacity: 0.5,
    },
    bookTitle: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 14,
      color: theme.text,
    },
    brandText: {
      fontFamily: "Poppins_400Regular",
      fontSize: 10,
      color: theme.text,
      opacity: 0.5,
      marginTop: 4,
    },
    shareButton: {
      flexDirection: "row",
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 24,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    shareButtonText: {
      fontFamily: "Poppins_600SemiBold",
      color: "#FFF",
      fontSize: 16,
    },
  });
