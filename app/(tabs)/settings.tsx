// app/(tabs)/settings.tsx

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { signOut, updateEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useColorScheme,
    View,
} from "react-native";
import { auth, db } from "../../config/firebase";
import { Colors } from "../../constants/Colors";
import { useBookStore } from "../../store/useBookStore";
import { uploadImageToCloudinary } from "../../services/cloudinaryService";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const setDarkMode = useBookStore((state) => state.setDarkMode);
  
  const isReminderEnabled = useBookStore((state) => state.isReminderEnabled);
  const setReminderEnabled = useBookStore((state) => state.setReminderEnabled);
  const reminderHour = useBookStore((state) => state.reminderHour);
  const reminderMinute = useBookStore((state) => state.reminderMinute);

  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const [dailyTarget, setDailyTarget] = useState(15);
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false);
  const [targetInput, setTargetInput] = useState("15");
  const [isLoading, setIsLoading] = useState(false);

  // Profil state
  const [displayName, setDisplayName] = useState("Pengguna Fokus Baca");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.dailyTarget) {
              setDailyTarget(data.dailyTarget);
              setTargetInput(data.dailyTarget.toString());
            }
            if (data.displayName) setDisplayName(data.displayName);
            if (data.firstName) setFirstName(data.firstName);
            if (data.lastName) setLastName(data.lastName);
            if (data.photoURL) setPhotoURL(data.photoURL);
          }
        } catch (error) {}
      }
    };
    fetchUserData();
  }, []);

  const openEditProfile = () => {
    // Gunakan nilai yang ada, jika firstName kosong coba split dari displayName
    let defaultFirst = firstName;
    let defaultLast = lastName;
    
    if (!defaultFirst && !defaultLast) {
      const parts = displayName.split(" ");
      defaultFirst = parts[0] || "";
      defaultLast = parts.slice(1).join(" ") || "";
    }
    
    setEditFirstName(defaultFirst);
    setEditLastName(defaultLast);
    setEditEmail(auth.currentUser?.email || "");
    setEditPhotoUri(null);
    setIsProfileModalVisible(true);
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Diperlukan", "Aplikasi perlu akses galeri foto untuk mengubah foto profil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    const trimmedFirstName = editFirstName.trim();
    const trimmedLastName = editLastName.trim();
    const trimmedEmail = editEmail.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      Alert.alert("Error", "Nama Depan dan Nama Belakang tidak boleh kosong.");
      return;
    }
    if (!trimmedEmail) {
      Alert.alert("Error", "Email tidak boleh kosong.");
      return;
    }

    const trimmedName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    setIsSavingProfile(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // Update Email di Firebase Auth jika berubah
      if (trimmedEmail !== auth.currentUser?.email) {
        try {
          await updateEmail(auth.currentUser!, trimmedEmail);
        } catch (emailError: any) {
          if (emailError.code === "auth/requires-recent-login") {
            Alert.alert(
              "Otentikasi Ulang Diperlukan", 
              "Untuk alasan keamanan, mengganti email mengharuskan Anda untuk keluar (Logout) dan masuk (Login) kembali terlebih dahulu sebelum mencoba lagi."
            );
            setIsSavingProfile(false);
            return;
          }
          throw emailError;
        }
      }

      let newPhotoURL = photoURL;

      // Upload foto baru ke Cloudinary jika ada
      if (editPhotoUri) {
        const fileName = `profile_${uid}_${Date.now()}.jpg`;
        const uploadResult = await uploadImageToCloudinary(editPhotoUri, fileName);
        newPhotoURL = uploadResult.secure_url;
      }

      await setDoc(
        doc(db, "users", uid),
        {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName: trimmedName,
          email: trimmedEmail,
          photoURL: newPhotoURL,
        },
        { merge: true },
      );

      setFirstName(trimmedFirstName);
      setLastName(trimmedLastName);
      setDisplayName(trimmedName);
      setPhotoURL(newPhotoURL);
      setIsProfileModalVisible(false);
      Alert.alert("Berhasil!", "Profil Anda telah diperbarui.");
    } catch (error: any) {
      Alert.alert("Gagal", error.message || "Terjadi kesalahan saat menyimpan profil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveDailyTarget = async () => {
    const newTarget = parseInt(targetInput);
    if (!newTarget || newTarget <= 0) {
      Alert.alert("Error", "Masukkan target menit yang valid.");
      return;
    }

    setIsLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await setDoc(
          doc(db, "users", uid),
          { dailyTarget: newTarget },
          { merge: true },
        );
        setDailyTarget(newTarget);
        setIsTargetModalVisible(false);
      }
    } catch (error) {
      Alert.alert("Error", "Gagal menyimpan target.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Keluar", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            Alert.alert("Error", "Gagal keluar dari akun.");
          }
        },
      },
    ]);
  };

  const handleInfoNotification = () => {
    const formattedHour = reminderHour.toString().padStart(2, "0");
    const formattedMinute = reminderMinute.toString().padStart(2, "0");
    Alert.alert(
      "Informasi Notifikasi",
      `Jika diaktifkan, aplikasi akan mengirimkan pengingat membaca harian setiap jam ${formattedHour}:${formattedMinute}. Ini membantu Anda menjaga konsistensi dan membangun kebiasaan membaca yang baik.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.subtitle}>Kelola akun dan preferensi Anda.</Text>
        </View>

        <View style={styles.content}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={openEditProfile} activeOpacity={0.85}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={36} color={theme.primary} />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.emailText}>
                {auth.currentUser?.email || "Memuat email..."}
              </Text>
              <TouchableOpacity style={styles.editProfileBtn} onPress={openEditProfile}>
                <Ionicons name="pencil-outline" size={14} color={theme.primary} />
                <Text style={styles.editProfileBtnText}>Edit Profil</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setIsTargetModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="flag-outline" size={24} color={theme.text} />
              <Text style={styles.menuItemText}>Target Harian</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{dailyTarget} Menit</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.lightGray}
              />
            </View>
          </TouchableOpacity>

          {/* Toggle Mode Gelap */}
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={24}
                color={theme.text}
              />
              <Text style={styles.menuItemText}>Mode Gelap</Text>
            </View>
            <Switch
              trackColor={{ false: theme.lightGray, true: theme.primary }}
              thumbColor={"#FFF"}
              ios_backgroundColor={theme.lightGray}
              onValueChange={(val) => setDarkMode(val)}
              value={isDark}
            />
          </View>

          {/* Toggle Notifikasi */}
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color={theme.text}
              />
              <Text style={styles.menuItemText}>Notifikasi Pengingat</Text>
              <TouchableOpacity onPress={handleInfoNotification} style={{ marginLeft: 8, padding: 4 }}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <Switch
              trackColor={{ false: theme.lightGray, true: theme.primary }}
              thumbColor={"#FFF"}
              ios_backgroundColor={theme.lightGray}
              onValueChange={(val) => setReminderEnabled(val)}
              value={isReminderEnabled}
            />
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#E76F51" />
            <Text style={styles.logoutText}>Keluar Akun</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Edit Profil */}
      <Modal animationType="slide" transparent={true} visible={isProfileModalVisible} onRequestClose={() => setIsProfileModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <View style={[styles.modalContent, { maxHeight: "85%" }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Profil</Text>
                  <TouchableOpacity onPress={() => setIsProfileModalVisible(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Preview Foto Profil */}
                  <TouchableOpacity style={styles.photoPickerWrapper} onPress={pickProfilePhoto} activeOpacity={0.85}>
                    {editPhotoUri ? (
                      <Image source={{ uri: editPhotoUri }} style={styles.photoPreview} />
                    ) : photoURL ? (
                      <Image source={{ uri: photoURL }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="person" size={48} color={theme.primary} />
                      </View>
                    )}
                    <View style={styles.photoPickerOverlay}>
                      <Ionicons name="camera" size={20} color="#FFF" />
                      <Text style={styles.photoPickerText}>Ubah</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Input Nama Depan */}
                  <Text style={styles.inputLabel}>Nama Depan</Text>
                  <View style={styles.inputGroup}>
                    <Ionicons name="person-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="Nama Depan"
                      placeholderTextColor={theme.lightGray}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Input Nama Belakang */}
                  <Text style={styles.inputLabel}>Nama Belakang</Text>
                  <View style={styles.inputGroup}>
                    <Ionicons name="people-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Nama Belakang"
                      placeholderTextColor={theme.lightGray}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Input Email */}
                  <Text style={styles.inputLabel}>Alamat Email</Text>
                  <View style={styles.inputGroup}>
                    <Ionicons name="mail-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={editEmail}
                      onChangeText={setEditEmail}
                      placeholder="email@contoh.com"
                      placeholderTextColor={theme.lightGray}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={() => setIsProfileModalVisible(false)}
                    >
                      <Text style={[styles.modalButtonText, { color: theme.text }]}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSaveButton]}
                      onPress={saveProfile}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.modalButtonText}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Target Harian */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isTargetModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "50%" }]}>
            <Text style={styles.modalTitle}>Target Harian (Menit)</Text>
            <Text style={styles.modalSubtitle}>
              Berapa lama Anda ingin fokus membaca setiap harinya?
            </Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="numeric"
              value={targetInput}
              onChangeText={setTargetInput}
              placeholder="Contoh: 30"
              placeholderTextColor={theme.lightGray}
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setIsTargetModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Batal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={saveDailyTarget}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Simpan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
    title: { fontFamily: "Poppins_700Bold", fontSize: 28, color: theme.text },
    subtitle: {
      fontFamily: "Lora_400Regular",
      fontSize: 16,
      color: theme.text,
      opacity: 0.8,
      marginTop: 4,
    },
    content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

    // Profile Card
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 20,
      marginBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    avatarWrapper: {
      position: "relative",
      marginRight: 16,
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.background,
    },
    avatarFallback: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.lightGray,
    },
    editBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.primary,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.surface,
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 17,
      color: theme.text,
      marginBottom: 2,
    },
    emailText: {
      fontFamily: "Lora_400Regular",
      fontSize: 13,
      color: theme.text,
      opacity: 0.7,
      marginBottom: 8,
    },
    editProfileBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    editProfileBtnText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 13,
      color: theme.primary,
      marginLeft: 4,
    },

    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    menuItemText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 16,
      color: theme.text,
      marginLeft: 16,
    },
    menuItemRight: { flexDirection: "row", alignItems: "center" },
    menuItemValue: {
      fontFamily: "Poppins_400Regular",
      fontSize: 14,
      color: theme.primary,
      marginRight: 8,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#FFD6D6",
      marginTop: 8,
    },
    logoutText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 16,
      color: "#E76F51",
      marginLeft: 16,
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 28,
      paddingBottom: 40,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 20,
      color: theme.text,
    },
    modalSubtitle: {
      fontFamily: "Lora_400Regular",
      fontSize: 14,
      color: theme.text,
      opacity: 0.7,
      textAlign: "center",
      marginBottom: 20,
    },

    // Photo picker
    photoPickerWrapper: {
      alignSelf: "center",
      marginBottom: 24,
      borderRadius: 60,
      overflow: "hidden",
      position: "relative",
    },
    photoPreview: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    photoPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.lightGray,
    },
    photoPickerOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingVertical: 8,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 4,
    },
    photoPickerText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 12,
      color: "#FFF",
      marginLeft: 4,
    },

    inputLabel: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 13,
      color: theme.text,
      opacity: 0.7,
      marginBottom: 8,
    },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 14,
      marginBottom: 24,
      paddingHorizontal: 16,
      height: 56,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    inputIcon: { marginRight: 12 },
    input: {
      flex: 1,
      fontFamily: "Poppins_400Regular",
      fontSize: 15,
      color: theme.text,
      paddingVertical: 0,
      includeFontPadding: false,
      textAlignVertical: "center",
    },

    timeInput: {
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      paddingVertical: 16,
      includeFontPadding: false,
      textAlignVertical: "center",
      fontFamily: "Poppins_600SemiBold",
      fontSize: 24,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.lightGray,
      textAlign: "center",
      marginBottom: 24,
    },

    modalButtonRow: {
      flexDirection: "row",
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    modalCancelButton: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    modalSaveButton: {
      backgroundColor: theme.primary,
    },
    modalButtonText: {
      fontFamily: "Poppins_600SemiBold",
      color: "#FFF",
      fontSize: 16,
    },
  });
