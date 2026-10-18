// app/(tabs)/index.tsx

import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { auth, db } from "../../config/firebase";
import { Colors } from "../../constants/Colors";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useBookStore } from "../../store/useBookStore";
import { generatePdfCoverUrl, uploadToCloudinary } from "../../services/cloudinaryService";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);

  // FIX TEMA: Membaca pilihan user dari pengaturan
  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  const setActiveBook = useBookStore((state) => state.setActiveBook);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem("hasSeenOnboarding");
        if (!hasSeen) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error("Gagal memuat status onboarding", error);
      }
    };
    checkOnboarding();
  }, []);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
      setShowOnboarding(false);
    } catch (error) {
      console.error("Gagal menyimpan status onboarding", error);
    }
  };

  useEffect(() => {
    const q = query(collection(db, "books"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const booksData: any[] = [];
        const currentUid = auth.currentUser?.uid;

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId === currentUid) {
            booksData.push({ id: doc.id, ...data });
          }
        });

        booksData.sort(
          (a, b) =>
            (b.uploadDate?.toMillis() || 0) - (a.uploadDate?.toMillis() || 0),
        );
        setBooks(booksData);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal mengambil data buku: ", error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const pickAndSaveDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const file = result.assets[0];
        const currentUid = auth.currentUser?.uid;

        if (!currentUid) {
          Alert.alert("Error", "Sesi login tidak valid.");
          return;
        }

        try {
          // V3 CLOUDINARY: Upload file ke cloud terlebih dahulu
          setIsUploading(true);
          const cloudResult = await uploadToCloudinary(
            file.uri,
            file.name,
            file.mimeType || "application/octet-stream",
          );

          // Generate cover URL dari Cloudinary (hanya untuk PDF)
          const isPdf = (file.mimeType || "").includes("pdf");
          const coverImage = isPdf
            ? generatePdfCoverUrl(cloudResult.public_id)
            : null;

          // Simpan secure_url dari Cloudinary ke Firestore (bukan URI lokal)
          await addDoc(collection(db, "books"), {
            title: file.name,
            uri: cloudResult.secure_url,
            cloudinaryPublicId: cloudResult.public_id,
            coverImage: coverImage,
            mimeType: file.mimeType,
            size: file.size,
            uploadDate: serverTimestamp(),
            progress: 0,
            userId: currentUid,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Berhasil!",
            `Buku "${file.name}" telah disimpan ke cloud dan rak Anda.`,
          );
        } catch (uploadErr: any) {
          Alert.alert(
            "Gagal Mengunggah",
            uploadErr.message || "Terjadi kesalahan saat mengunggah file.",
          );
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      Alert.alert("Error", "Gagal membuka file manager.");
    }
  };

  const handleDeleteBook = (id: string, title: string) => {
    Alert.alert("Hapus Buku", `Yakin ingin menghapus "${title}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "books", id));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            Alert.alert("Error", "Gagal menghapus buku.");
          }
        },
      },
    ]);
  };

  const handleRereadBook = (id: string, title: string, currentReadCount: number = 0, currentProgress: number = 0) => {
    Alert.alert("Baca Ulang", `Yakin ingin mengulang membaca "${title}" dari awal?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Mulai Ulang",
        onPress: async () => {
          try {
            const newReadCount = currentProgress === 100 ? currentReadCount + 1 : currentReadCount;
            await updateDoc(doc(db, "books", id), {
              progress: 0,
              lastPosition: "1",
              readCount: newReadCount
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            Alert.alert("Error", "Gagal mereset progress buku.");
          }
        },
      },
    ]);
  };

  const handleReplaceBook = async (id: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const file = result.assets[0];
        try {
          // V3 CLOUDINARY: Upload file pengganti ke cloud
          setIsUploading(true);
          const cloudResult = await uploadToCloudinary(
            file.uri,
            file.name,
            file.mimeType || "application/octet-stream",
          );

          // Generate cover URL dari Cloudinary (hanya untuk PDF)
          const isReplacePdf = (file.mimeType || "").includes("pdf");
          const replaceCoverImage = isReplacePdf
            ? generatePdfCoverUrl(cloudResult.public_id)
            : null;

          await updateDoc(doc(db, "books", id), {
            title: file.name,
            uri: cloudResult.secure_url,
            cloudinaryPublicId: cloudResult.public_id,
            coverImage: replaceCoverImage,
            mimeType: file.mimeType,
            size: file.size,
            uploadDate: serverTimestamp(),
          });
          Alert.alert(
            "Berhasil!",
            `Buku telah diganti menjadi "${file.name}".`,
          );
        } catch (uploadErr: any) {
          Alert.alert(
            "Gagal Mengunggah",
            uploadErr.message || "Terjadi kesalahan saat mengunggah file.",
          );
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      Alert.alert("Error", "Gagal membuka file manager.");
    }
  };

  const renderRightActions = (item: any) => {
    const showReread = item.progress === 100 || (item.readCount && item.readCount > 0);
    const containerWidth = showReread ? 210 : 140;

    return (
      <View style={[styles.swipeActionsContainer, { width: containerWidth }]}>
        {showReread && (
          <TouchableOpacity
            style={styles.rereadButton}
            onPress={() => handleRereadBook(item.id, item.title, item.readCount, item.progress)}
          >
            <Ionicons name="refresh-circle" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.replaceButton}
          onPress={() => handleReplaceBook(item.id)}
        >
          <Ionicons name="refresh" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteBook(item.id, item.title)}
        >
          <Ionicons name="trash" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookItem = ({ item }: { item: any }) => {
    const completedCount = (item.readCount || 0) + (item.progress === 100 ? 1 : 0);
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        containerStyle={styles.swipeableContainer}
      >
        <TouchableOpacity
          style={styles.bookCard}
          activeOpacity={0.8}
          onPress={() => {
            setActiveBook({
              id: item.id,
              title: item.title,
              uri: item.uri,
              hasCover: item.coverImage ? "true" : "false",
            });
            router.push("/reader");
          }}
        >
          {item.coverImage ? (
            <Image
              source={{ uri: item.coverImage }}
              style={styles.bookCoverImage}
            />
          ) : (
            <View style={styles.bookIconContainer}>
              <Ionicons name="book" size={24} color={theme.primary} />
            </View>
          )}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.bookProgress}>
              Progress: {item.progress || 0}%
            </Text>
            {completedCount > 0 && (
              <Text style={styles.bookReadCount}>
                Sudah dibaca: {completedCount} kali
              </Text>
            )}
          </View>
          <Ionicons
            name="chevron-back"
            size={20}
            color={theme.lightGray}
            style={{ marginRight: 8 }}
          />
          <Ionicons name="chevron-forward" size={20} color={theme.lightGray} />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.background}
        />

        <View style={styles.header}>
          <Text style={styles.title}>Fokus Baca</Text>
          <Text style={styles.subtitle}>
            Tingkatkan kualitas membaca, sedikit demi sedikit.
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#888" : theme.lightGray}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari judul buku..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={isDark ? "#888" : theme.lightGray}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearch}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={isDark ? "#888" : theme.lightGray}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : filteredBooks.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>
                {searchQuery.length > 0
                  ? "Buku tidak ditemukan"
                  : "Belum ada buku"}
              </Text>
              <Text style={styles.emptyStateDesc}>
                {searchQuery.length > 0
                  ? "Coba gunakan kata kunci pencarian yang lain."
                  : "Mulai perjalanan membacamu hari ini dengan mengunggah e-book pertamamu."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              renderItem={renderBookItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.uploadButton}
            activeOpacity={0.8}
            onPress={pickAndSaveDocument}
          >
            <Text style={styles.uploadButtonText}>+ Unggah E-Book</Text>
          </TouchableOpacity>
        </View>

        {/* V3 CLOUDINARY: Modal overlay saat upload file ke cloud */}
        <Modal animationType="fade" transparent={true} visible={isUploading}>
          <View style={styles.modalOverlay}>
            <View style={styles.onboardingContent}>
              <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 20 }} />
              <Text style={styles.onboardingTitle}>Mengunggah ke Cloud...</Text>
              <Text style={[styles.stepText, { textAlign: "center" }]}>
                Sedang mengunggah file buku Anda ke Cloudinary agar bisa diakses dari perangkat manapun.
              </Text>
            </View>
          </View>
        </Modal>

        <Modal animationType="fade" transparent={true} visible={showOnboarding}>
          <View style={styles.modalOverlay}>
            <View style={styles.onboardingContent}>
              <Text style={styles.onboardingTitle}>
                Selamat datang di Fokus Baca
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.onboardingStep}>
                  <Text style={styles.stepNumber}>1</Text>
                  <Text style={styles.stepText}>
                    Aplikasi ini dirancang untuk membantu Anda membangun
                    kebiasaan rutin membaca buku setiap hari.
                  </Text>
                </View>
                <View style={styles.onboardingStep}>
                  <Text style={styles.stepNumber}>2</Text>
                  <Text style={styles.stepText}>
                    Mulailah dengan menekan tombol unggah di bawah untuk
                    memasukkan dokumen yang ingin Anda baca dari perangkat Anda.
                  </Text>
                </View>
                <View style={styles.onboardingStep}>
                  <Text style={styles.stepNumber}>3</Text>
                  <Text style={styles.stepText}>
                    Sebelum membaca, Anda dapat mengatur target waktu. Waktu
                    akan terus berjalan selama Anda membuka buku. Selesaikan
                    target waktu tersebut untuk mencatat kemajuan membaca Anda.
                  </Text>
                </View>
              </ScrollView>
              <TouchableOpacity
                style={styles.onboardingButton}
                onPress={finishOnboarding}
                activeOpacity={0.8}
              >
                <Text style={styles.onboardingButtonText}>
                  Mengerti dan Mulai Membaca
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Pola getStyles agar dinamis merespons tema
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
    title: { fontFamily: "Poppins_700Bold", fontSize: 28, color: theme.text },
    subtitle: {
      fontFamily: "Lora_400Regular",
      fontSize: 16,
      color: theme.text,
      opacity: 0.8,
      marginTop: 4,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      marginHorizontal: 24,
      marginBottom: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.lightGray,
      height: 50,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontFamily: "Poppins_400Regular",
      fontSize: 14,
      color: theme.text,
    },
    clearSearch: { padding: 4 },
    content: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
    listContainer: { paddingTop: 8, paddingBottom: 20 },
    swipeableContainer: { marginBottom: 12 },
    bookCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    swipeActionsContainer: {
      flexDirection: "row",
      height: "100%",
      marginLeft: -16,
    },
    rereadButton: {
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      flex: 1,
    },
    deleteButton: {
      backgroundColor: "#E76F51",
      justifyContent: "center",
      alignItems: "center",
      flex: 1,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },
    replaceButton: {
      backgroundColor: theme.secondary,
      justifyContent: "center",
      alignItems: "center",
      flex: 1,
    },
    bookCoverImage: {
      width: 48,
      height: 64,
      borderRadius: 8,
      marginRight: 16,
      backgroundColor: theme.lightGray,
    },
    bookIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    bookInfo: { flex: 1, marginRight: 8 },
    bookTitle: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 14,
      color: theme.text,
      marginBottom: 4,
    },
    bookProgress: {
      fontFamily: "Lora_400Regular",
      fontSize: 12,
      color: theme.text,
      opacity: 0.6,
    },
    bookReadCount: {
      fontFamily: "Lora_400Regular",
      fontSize: 12,
      color: theme.primary,
      marginTop: 4,
    },
    emptyStateCard: {
      backgroundColor: theme.surface,
      padding: 24,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    emptyStateTitle: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 18,
      color: theme.text,
      marginBottom: 8,
    },
    emptyStateDesc: {
      fontFamily: "Lora_400Regular",
      fontSize: 14,
      color: theme.text,
      textAlign: "center",
      opacity: 0.7,
      lineHeight: 22,
    },
    footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
    uploadButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    uploadButtonText: {
      fontFamily: "Poppins_600SemiBold",
      color: "#FFF",
      fontSize: 16,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    onboardingContent: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 32,
      width: "100%",
      maxHeight: "80%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    },
    onboardingTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 22,
      color: theme.text,
      marginBottom: 24,
      textAlign: "center",
    },
    onboardingStep: {
      flexDirection: "row",
      marginBottom: 20,
      alignItems: "flex-start",
    },
    stepNumber: {
      backgroundColor: theme.lightGray,
      color: theme.text,
      fontFamily: "Poppins_700Bold",
      fontSize: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      textAlign: "center",
      lineHeight: 28,
      marginRight: 16,
      marginTop: 2,
    },
    stepText: {
      flex: 1,
      fontFamily: "Lora_400Regular",
      fontSize: 14,
      color: theme.text,
      lineHeight: 22,
      opacity: 0.8,
    },
    onboardingButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 12,
    },
    onboardingButtonText: {
      fontFamily: "Poppins_600SemiBold",
      color: "#FFF",
      fontSize: 16,
    },
  });
