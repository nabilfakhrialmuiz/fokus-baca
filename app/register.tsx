// app/register.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../config/firebase";
import { Colors } from "../constants/Colors";
import { useBookStore } from "../store/useBookStore";
import { uploadImageToCloudinary } from "../services/cloudinaryService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Slide Config ─────────────────────────────────────────────────────────────
const TOTAL_SLIDES = 5;

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  // ── Navigation ──
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Form State ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Navigation Helpers ──
  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: true });
    setCurrentStep(index);
    Animated.timing(progressAnim, {
      toValue: (index + 1) / TOTAL_SLIDES,
      duration: 350,
      useNativeDriver: false,
    }).start();
  };

  const nextSlide = () => {
    if (currentStep === 0 && !firstName.trim()) {
      Alert.alert("Wajib Diisi", "Harap masukkan nama depan Anda.");
      return;
    }
    if (currentStep === 1 && !lastName.trim()) {
      Alert.alert("Wajib Diisi", "Harap masukkan nama belakang Anda.");
      return;
    }
    if (currentStep === 2) {
      if (!email.trim()) {
        Alert.alert("Wajib Diisi", "Harap masukkan alamat email Anda.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert("Email Tidak Valid", "Masukkan format email yang benar.");
        return;
      }
    }
    if (currentStep === 3) {
      if (!password || !confirmPassword) {
        Alert.alert("Wajib Diisi", "Harap isi kata sandi dan konfirmasinya.");
        return;
      }
      if (password.length < 6) {
        Alert.alert("Kata Sandi Terlalu Pendek", "Kata sandi minimal 6 karakter.");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Tidak Cocok", "Kata sandi dan konfirmasi tidak sesuai.");
        return;
      }
    }
    if (currentStep < TOTAL_SLIDES - 1) {
      goToSlide(currentStep + 1);
    }
  };

  const prevSlide = () => {
    if (currentStep > 0) goToSlide(currentStep - 1);
    else router.back();
  };

  // ── Photo Picker ──
  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Diperlukan", "Aplikasi perlu akses galeri untuk memilih foto profil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhotoUri(result.assets[0].uri);
    }
  };

  // ── Register Handler ──
  const handleRegister = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const uid = userCredential.user.uid;

      // Upload foto profil ke Cloudinary jika ada
      let photoURL: string | null = null;
      if (profilePhotoUri) {
        try {
          const fileName = `profile_${uid}_${Date.now()}.jpg`;
          const uploadResult = await uploadImageToCloudinary(profilePhotoUri, fileName);
          photoURL = uploadResult.secure_url;
        } catch (uploadErr) {
          // Foto gagal upload, tapi tetap lanjutkan registrasi
          console.warn("Gagal upload foto profil:", uploadErr);
        }
      }

      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Simpan profil pengguna ke Firestore
      await setDoc(doc(db, "users", uid), {
        email: userCredential.user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        photoURL,
        dailyTarget: 15,
        createdAt: new Date(),
      });
    } catch (error: any) {
      Alert.alert("Gagal Mendaftar", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Progress Bar ──────────────────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // ─── Slide Content ─────────────────────────────────────────────────────────
  const slides = [
    // Slide 0: Nama Depan
    {
      key: "firstName",
      icon: "person-outline" as const,
      title: "Halo!",
      subtitle: "Mari kita mulai. Siapa nama depan Anda?",
      content: (
        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nama Depan"
            placeholderTextColor={theme.lightGray}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={nextSlide}
          />
        </View>
      ),
    },
    // Slide 1: Nama Belakang
    {
      key: "lastName",
      icon: "person-outline" as const,
      title: `Senang bertemu,\n${firstName || "Anda"}!`,
      subtitle: "Sekarang, apa nama belakang Anda?",
      content: (
        <View style={styles.inputGroup}>
          <Ionicons name="people-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nama Belakang"
            placeholderTextColor={theme.lightGray}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={nextSlide}
          />
        </View>
      ),
    },
    // Slide 2: Email
    {
      key: "email",
      icon: "mail-outline" as const,
      title: "Alamat Email",
      subtitle: "Gunakan email aktif untuk masuk ke akun Anda.",
      content: (
        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="email@contoh.com"
            placeholderTextColor={theme.lightGray}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={nextSlide}
          />
        </View>
      ),
    },
    // Slide 3: Password
    {
      key: "password",
      icon: "lock-closed-outline" as const,
      title: "Buat Kata Sandi 🔐",
      subtitle: "Minimal 6 karakter. Pastikan mudah diingat!",
      content: (
        <View>
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Kata Sandi"
              placeholderTextColor={theme.lightGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="next"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={theme.lightGray}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.lightGray} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Konfirmasi Kata Sandi"
              placeholderTextColor={theme.lightGray}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={nextSlide}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={theme.lightGray}
              />
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
    // Slide 4: Foto Profil (opsional)
    {
      key: "photo",
      icon: "camera-outline" as const,
      title: "Foto Profil 📸",
      subtitle: "Opsional — Anda bisa mengubahnya kapan saja di pengaturan.",
      content: (
        <View style={styles.photoSlideContainer}>
          <TouchableOpacity style={styles.photoPickerBtn} onPress={pickProfilePhoto} activeOpacity={0.85}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person-add-outline" size={48} color={theme.primary} />
                <Text style={styles.photoPlaceholderText}>Pilih dari Galeri</Text>
              </View>
            )}
          </TouchableOpacity>
          {profilePhotoUri && (
            <TouchableOpacity onPress={() => setProfilePhotoUri(null)} style={styles.removePhotoBtn}>
              <Ionicons name="close-circle" size={16} color="#E76F51" />
              <Text style={styles.removePhotoText}>Hapus Foto</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* ── Header dengan Progress ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={prevSlide}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth, backgroundColor: theme.primary },
              ]}
            />
          </View>
          <Text style={styles.stepCounter}>{currentStep + 1}/{TOTAL_SLIDES}</Text>
        </View>

        {/* ── Step Dots ── */}
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i <= currentStep ? theme.primary : theme.lightGray,
                  width: i === currentStep ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* ── Slides ── */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.slidesScrollView}
          keyboardShouldPersistTaps="handled"
        >
          {slides.map((slide, index) => (
            <View key={slide.key} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
              <View style={styles.slideContent}>{slide.content}</View>
            </View>
          ))}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          {currentStep < TOTAL_SLIDES - 1 ? (
            <TouchableOpacity style={styles.primaryButton} onPress={nextSlide} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Lanjut</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Daftar Sekarang</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          )}

          {currentStep === TOTAL_SLIDES - 1 && !loading && (
            <TouchableOpacity style={styles.skipButton} onPress={handleRegister}>
              <Text style={styles.skipButtonText}>Lewati, daftar tanpa foto</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Masuk di sini</Text>
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
    container: { flex: 1 },

    // Top bar
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 12,
    },
    backButton: {
      padding: 4,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      backgroundColor: theme.lightGray,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    stepCounter: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 13,
      color: theme.text,
      opacity: 0.6,
      width: 32,
      textAlign: "right",
    },

    // Dots
    dotsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginBottom: 8,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },

    // Slides
    slidesScrollView: {
      flex: 1,
    },
    slide: {
      paddingHorizontal: 32,
      paddingTop: 24,
    },
    slideTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 28,
      color: theme.text,
      marginBottom: 10,
      lineHeight: 38,
    },
    slideSubtitle: {
      fontFamily: "Lora_400Regular",
      fontSize: 15,
      color: theme.text,
      opacity: 0.7,
      lineHeight: 24,
      marginBottom: 32,
    },
    slideContent: {
      width: "100%",
    },

    // Inputs
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
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
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
    eyeButton: { padding: 4, marginLeft: 8 },

    // Photo slide
    photoSlideContainer: {
      alignItems: "center",
      paddingTop: 8,
    },
    photoPickerBtn: {
      borderRadius: 80,
      overflow: "hidden",
      marginBottom: 16,
    },
    photoPreview: {
      width: 160,
      height: 160,
      borderRadius: 80,
    },
    photoPlaceholder: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.lightGray,
      borderStyle: "dashed",
      gap: 8,
    },
    photoPlaceholderText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 12,
      color: theme.primary,
      marginTop: 4,
    },
    removePhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      padding: 8,
    },
    removePhotoText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 13,
      color: "#E76F51",
      marginLeft: 4,
    },

    // Footer
    footer: {
      paddingHorizontal: 32,
      paddingBottom: 24,
      paddingTop: 8,
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      height: 60,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 16,
      color: "#FFF",
    },
    skipButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    skipButtonText: {
      fontFamily: "Poppins_400Regular",
      fontSize: 13,
      color: theme.text,
      opacity: 0.6,
      textDecorationLine: "underline",
    },
    footerContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 8,
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
