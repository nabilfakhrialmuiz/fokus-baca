// app/reader.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  Animated,
  PanResponder,
  AppState,
} from "react-native";
import { WebView } from "react-native-webview";
import { Colors } from "../constants/Colors";
// FASE A3: Import library Native PDF
import Pdf from "react-native-pdf";

import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useBookStore } from "../store/useBookStore";
import { ShareQuoteModal } from "../components/ShareQuoteModal";
import * as Speech from "expo-speech";

export default function ReaderScreen() {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const isDark =
    storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  const router = useRouter();
  const navigation = useNavigation();

  const activeBook = useBookStore((state) => state.activeBook);
  const id = activeBook?.id || "";
  const title = activeBook?.title || "Buku Tidak Ditemukan";
  const uri = activeBook?.uri || "";
  const hasCover = activeBook?.hasCover || "false";

  const [initialTime, setInitialTime] = useState(15 * 60);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);

  const [totalSecondsRead, setTotalSecondsRead] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("15");

  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEpub, setIsEpub] = useState(false);

  const [lastPosition, setLastPosition] = useState<string | null>(null);
  const [currentLoc, setCurrentLoc] = useState<string | null>(null);
  const [readProgress, setReadProgress] = useState(0);

  const currentLocRef = useRef<string | null>(null);
  const readProgressRef = useRef<number>(0);
  // v1.2.5: Catat halaman awal saat sesi mulai untuk menghitung pagesRead
  const startPageRef = useRef<number>(0);
  const currentPageRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const [showHighlightBtn, setShowHighlightBtn] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFadeTimeout = () => {
    if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    fadeTimeout.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0.4,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 5000);
  };

  useEffect(() => {
    resetFadeTimeout();
    return () => {
      if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        resetFadeTimeout();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        resetFadeTimeout();
      },
    })
  ).current;

  useEffect(() => {
    const loadFile = async () => {
      try {
        if (!uri) return;
        setIsEpub(title?.toLowerCase().endsWith(".epub") || false);

        if (id) {
          const bookSnap = await getDoc(doc(db, "books", id as string));
          if (bookSnap.exists()) {
            const data = bookSnap.data();
            if (data.lastPosition) {
              setLastPosition(data.lastPosition);
              currentLocRef.current = data.lastPosition;
            }
            if (data.notes) setNoteText(data.notes);
            if (data.progress) {
              setReadProgress(data.progress);
              readProgressRef.current = data.progress;
            }
          }
        }

        let currentLocalUri = uri;
        if (uri.startsWith("http://") || uri.startsWith("https://")) {
          let ext = ".pdf";
          if (title?.toLowerCase().endsWith(".epub")) ext = ".epub";
          
          let safeTitle = title ? title.replace(/[^a-zA-Z0-9]/g, "_") : "book";
          const filename = `${id}_${safeTitle}${ext}`;
          const destPath = `${FileSystem.documentDirectory}${filename}`;
          const fileInfo = await FileSystem.getInfoAsync(destPath);
          
          if (!fileInfo.exists) {
            const downloadResult = await FileSystem.downloadAsync(uri, destPath);
            currentLocalUri = downloadResult.uri;
          } else {
            currentLocalUri = destPath;
          }
        }

        setLocalFileUri(currentLocalUri);

        // FASE A3: Base64 hanya dibutuhkan untuk EPUB. PDF akan langsung dibaca urinya oleh library native.
        if (title?.toLowerCase().endsWith(".epub")) {
          const base64 = await FileSystem.readAsStringAsync(currentLocalUri, {
            encoding: "base64",
          });
          setFileBase64(base64);
        } else {
          setFileBase64("ready_for_native");
        }
      } catch (error) {
        console.error("Error loading file:", error);
        setErrorMessage(
          "Gagal memuat file. Periksa koneksi internet Anda atau file mungkin rusak.",
        );
      } finally {
        setIsLoadingFile(false);
      }
    };
    loadFile();
  }, [uri]);

  const saveReadingSession = async (durationToSave: number) => {
    try {
      if (durationToSave > 0) {
        // v1.2.5: Hitung jumlah halaman yang dibaca dalam sesi ini
        const pagesRead = Math.max(0, currentPageRef.current - startPageRef.current);
        const sessionData = {
          bookId: id,
          bookTitle: title,
          durationSeconds: durationToSave,
          userId: auth.currentUser?.uid || "anonymous",
          date: serverTimestamp(),
          pagesRead: pagesRead,
          lastPage: currentPageRef.current,
        };

        if (sessionIdRef.current) {
          // Update sesi yang sudah ada agar tidak spam database saat auto-save
          await updateDoc(doc(db, "reading_sessions", sessionIdRef.current), sessionData);
        } else {
          // Buat sesi baru
          const docRef = await addDoc(collection(db, "reading_sessions"), sessionData);
          sessionIdRef.current = docRef.id;
        }
      }
      if (id) {
        const updateData: any = { progress: readProgressRef.current };
        if (currentLocRef.current)
          updateData.lastPosition = currentLocRef.current;
        await updateDoc(doc(db, "books", id as string), updateData);
      }
    } catch (error) {}
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && targetEndTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((targetEndTime - now) / 1000));
        if (remaining === 0) {
          setIsRunning(false);
          setSessionFinished(true);
          setTargetEndTime(null);
          clearInterval(interval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          let finalTotal = totalSecondsRead;
          if (sessionStartTime) {
            finalTotal += Math.floor((Date.now() - sessionStartTime) / 1000);
            setTotalSecondsRead(finalTotal);
            setSessionStartTime(null);
          }
          saveReadingSession(finalTotal);
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, targetEndTime, sessionStartTime, totalSecondsRead]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isRunning) {
      setTargetEndTime(Date.now() + timeLeft * 1000);
      setSessionStartTime(Date.now());
      setIsRunning(true);
    } else {
      setIsRunning(false);
      setTargetEndTime(null);
      if (sessionStartTime) {
        setTotalSecondsRead(
          (prev) => prev + Math.floor((Date.now() - sessionStartTime) / 1000),
        );
        setSessionStartTime(null);
      }
    }
  };

  const handleBackButton = () => {
    router.back();
  };

  // ─── AppState Auto-Save ───
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        if (isRunning || totalSecondsRead > 0) {
          let currentTotal = totalSecondsRead;
          if (isRunning && sessionStartTime) {
            currentTotal += Math.floor((Date.now() - sessionStartTime) / 1000);
          }
          await saveReadingSession(currentTotal);
        }
      } else if (nextAppState === "active") {
        if (isRunning) {
          setSessionStartTime(Date.now());
        }
      }
    });
    return () => subscription.remove();
  }, [isRunning, totalSecondsRead, sessionStartTime, id, title]);

  // ─── Intercept Navigation (Tombol Kembali) ───
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      // Jika tidak membaca atau sesi sudah selesai, izinkan keluar langsung
      if (!isRunning && totalSecondsRead === 0 || sessionFinished) {
        return;
      }

      e.preventDefault();

      let finalTimeRead = totalSecondsRead;
      if (isRunning && sessionStartTime) {
        finalTimeRead += Math.floor((Date.now() - sessionStartTime) / 1000);
      }

      const mins = Math.floor(finalTimeRead / 60);
      const secs = finalTimeRead % 60;

      Alert.alert(
        "Akhiri Sesi Baca?",
        `Anda baru membaca selama ${mins} menit ${secs} detik. Waktu jeda (pause) tidak dihitung. Apakah Anda ingin menyimpannya?`,
        [
          { text: "Batal Keluar", style: "cancel" },
          {
            text: "Keluar Tanpa Menyimpan",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: "Tutup & Simpan",
            onPress: async () => {
              if (isRunning) {
                toggleTimer(); // Stop timer agar perhitungan tidak ganda
              }
              await saveReadingSession(finalTimeRead);
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isRunning, sessionStartTime, totalSecondsRead, sessionFinished]);

  const saveNotes = async () => {
    if (!id) return;
    setIsSavingNote(true);
    try {
      await updateDoc(doc(db, "books", id as string), { notes: noteText });
    } catch (error) {
    } finally {
      setIsSavingNote(false);
      setIsNoteModalVisible(false);
    }
  };

  const applyHighlight = () => {
    if (isEpub && webViewRef.current) {
      const highlightScript = `
          var selection = window.getSelection();
          if (selection.rangeCount > 0) {
              var range = selection.getRangeAt(0); var mark = document.createElement('mark');
              mark.style.backgroundColor = '#E9C46A'; mark.style.color = '#264653'; mark.style.borderRadius = '3px';
              range.surroundContents(mark); window.getSelection().removeAllRanges();
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clear_selection' })); true;
        `;
      webViewRef.current.injectJavaScript(highlightScript);
    }
  };

  // V3 TASK 3: Cleanup TTS ketika keluar dari halaman reader
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // V3 TASK 3: Fungsi untuk toggle TTS pada buku EPUB
  const toggleTTS = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      if (isEpub && webViewRef.current) {
        // Injeksi JS untuk mengekstrak teks dari halaman yang aktif
        const extractTextScript = `
          var text = "";
          if (rendition && rendition.getContents().length > 0) {
            var doc = rendition.getContents()[0].document;
            text = doc.body.innerText || doc.body.textContent;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tts_text', text: text }));
          true;
        `;
        webViewRef.current.injectJavaScript(extractTextScript);
      }
    }
  };

  const htmlBg = isDark ? "#121212" : "#F8F9FA";
  const htmlText = isDark ? "#E0E0E0" : "#264653";

  // FASE A3: WebView HANYA dirender jika file adalah EPUB.
  const epubHtmlContent = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script><script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"></script>
    <style>body { margin: 0; background-color: ${htmlBg}; overflow: hidden; color: ${htmlText}; } #viewer { width: 100vw; height: 100vh; } #loading { font-family: sans-serif; font-size: 14px; margin-top: 50px; text-align: center; width: 100%; color: ${htmlText}; }</style>
    </head><body><div id="loading">Memproses EPUB...</div><div id="viewer"></div>
    <script>
      const binary = atob('${fileBase64}'); const len = binary.length; const buffer = new ArrayBuffer(len); const view = new Uint8Array(buffer);
      for (let i = 0; i < len; i++) { view[i] = binary.charCodeAt(i); }
      const book = ePub(buffer); const rendition = book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });
      if ('${isDark}' === 'true') { rendition.themes.default({ body: { background: '${htmlBg} !important', color: '${htmlText} !important' }, p: { color: '${htmlText} !important' }, h1: { color: '${htmlText} !important' }, h2: { color: '${htmlText} !important' } }); }
      let displayLocation = ('${lastPosition}' !== 'null' && '${lastPosition}' !== '') ? '${lastPosition}' : undefined;
      rendition.display(displayLocation).then(() => { document.getElementById('loading').style.display = 'none'; });
      book.ready.then(() => { return book.locations.generate(1600); });
      rendition.on("selected", function(cfiRange, contents) {
         const selection = contents.window.getSelection(); const text = selection.toString().trim();
         if(text.length > 0) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selection', text: text }));
      });
      rendition.hooks.content.register(function(contents) { contents.document.addEventListener('click', function(e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clear_selection' })); }); });
      rendition.on("rendered", function(e){
          rendition.hooks.content.register(function(contents) {
              var el = contents.document.documentElement;
              if (el) { el.addEventListener('click', function(e) { if(contents.window.getSelection().toString().length > 0) return; var clientX = e.clientX; if(clientX < window.innerWidth / 3) rendition.prev(); else if(clientX > (window.innerWidth / 3) * 2) rendition.next(); }); }
          });
      });
      rendition.on("relocated", function(location) {
         let percent = 0; if (book.locations.length > 0) { percent = Math.round(book.locations.percentageFromCfi(location.start.cfi) * 100); }
         window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loc', loc: location.start.cfi, percent: percent }));
      });
    </script></body></html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.surface}
        translucent={true}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackButton} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.pdfViewerContainer}>
        {isLoadingFile ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.stateText}>Menyiapkan Buku...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={60}
              color={theme.secondary}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.errorTitle}>Ups, Terjadi Kesalahan</Text>
            <Text style={styles.errorDesc}>{errorMessage}</Text>
          </View>
        ) : isEpub ? (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: epubHtmlContent }}
            style={{ flex: 1, backgroundColor: theme.background }}
            showsVerticalScrollIndicator={false}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "loc") {
                  setCurrentLoc(data.loc);
                  if (data.percent !== undefined) {
                    setReadProgress(data.percent);
                    readProgressRef.current = data.percent;
                  }
                } else if (data.type === "selection") {
                  setSelectedText(data.text);
                  setShowHighlightBtn(true);
                } else if (data.type === "clear_selection") {
                  setShowHighlightBtn(false);
                  setSelectedText("");
                } else if (data.type === "tts_text") {
                  // V3 TASK 3: Mainkan TTS setelah mendapatkan teks
                  if (data.text) {
                    setIsSpeaking(true);
                    Speech.speak(data.text, {
                      language: "id-ID",
                      pitch: 1.0,
                      rate: 0.9,
                      onDone: () => setIsSpeaking(false),
                      onStopped: () => setIsSpeaking(false),
                      onError: () => setIsSpeaking(false),
                    });
                  }
                }
              } catch (e) {}
            }}
          />
        ) : (
          // FASE A3: NATIVE PDF RENDERING
          // Ini sangat cepat dan tidak akan lag meskipun PDF berjumlah 2000 halaman!
          <Pdf
            source={{ uri: localFileUri || uri, cache: true }}
            trustAllCerts={false}
            onLoadComplete={(numberOfPages) => {
              // Jika buku baru pertama kali dibuka, catat persentase hal 1
              const startPage = lastPosition ? parseInt(lastPosition) : 1;
              if (!lastPosition) {
                const initialPct = Math.round((1 / numberOfPages) * 100);
                setReadProgress(initialPct);
                readProgressRef.current = initialPct;
                setCurrentLoc("1");
                currentLocRef.current = "1";
              }
              // v1.2.5: Catat halaman awal sesi
              startPageRef.current = startPage;
              currentPageRef.current = startPage;
            }}
            page={lastPosition ? parseInt(lastPosition) : 1}
            onPageChanged={(page, numberOfPages) => {
              // Update persentase setiap kali halaman digeser
              const pct = Math.round((page / numberOfPages) * 100);
              setReadProgress(pct);
              readProgressRef.current = pct;
              setCurrentLoc(page.toString());
              currentLocRef.current = page.toString();
              // v1.2.5: Update halaman terkini
              currentPageRef.current = page;
            }}
            onError={(error) => {
              console.log(error);
              setErrorMessage("Format PDF rusak atau tidak dapat dirender.");
            }}
            style={{ flex: 1, backgroundColor: theme.background }}
            enablePaging={true}
            spacing={10}
            fitPolicy={0}
          />
        )}

        {showHighlightBtn && isEpub && (
          <View style={styles.floatingActionContainer}>
            <TouchableOpacity
              style={styles.floatingHighlightButton}
              onPress={applyHighlight}
              activeOpacity={0.8}
            >
              <Ionicons
                name="color-wand"
                size={20}
                color={Colors.light.text}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.highlightButtonText}>Tandai (Stabilo)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingShareButton}
              onPress={() => setIsShareModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-social"
                size={20}
                color={Colors.light.text}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.highlightButtonText}>Bagikan Kutipan</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoadingFile && !errorMessage && fileBase64 && (
          <TouchableOpacity
            style={styles.fabNotes}
            onPress={() => setIsNoteModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={24} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* V3 TASK 3: Tombol TTS (Megaphone) khusus untuk EPUB */}
        {!isLoadingFile && !errorMessage && fileBase64 && isEpub && (
          <TouchableOpacity
            style={[
              styles.fabTTS,
              isSpeaking ? { backgroundColor: theme.primary } : {},
            ]}
            onPress={toggleTTS}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isSpeaking ? "volume-mute" : "megaphone"}
              size={24}
              color="#FFF"
            />
          </TouchableOpacity>
        )}

        {!isLoadingFile && !errorMessage && fileBase64 && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.timerPillContainer,
              {
                transform: pan.getTranslateTransform(),
                opacity: opacity,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={resetFadeTimeout}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>

              {!isRunning && (
                <TouchableOpacity
                  style={{ padding: 8, marginLeft: 4 }}
                  onPress={() => {
                    resetFadeTimeout();
                    setIsTimerModalVisible(true);
                  }}
                >
                  <Ionicons name="pencil" size={16} color={theme.primary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.playButton,
                  isRunning ? styles.pauseButton : null,
                  { marginLeft: isRunning ? 16 : 8, width: 40, height: 40, borderRadius: 20 },
                ]}
                onPress={() => {
                  resetFadeTimeout();
                  toggleTimer();
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isRunning ? "pause" : "play"}
                  size={20}
                  color="#FFF"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Modal animationType="slide" transparent={true} visible={sessionFinished}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
            <Text style={styles.modalTitle}>Selesai!</Text>
            <Text style={styles.modalText}>
              Waktu membacamu hari ini sudah selesai. Progress Anda telah
              disimpan!
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setSessionFinished(false);
                router.back();
              }}
            >
              <Text style={styles.modalButtonText}>Tutup Buku</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isNoteModalVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { height: "70%", justifyContent: "flex-start" },
            ]}
          >
            <View style={styles.noteHeader}>
              <Text style={styles.modalTitle}>Catatan Buku</Text>
              <TouchableOpacity onPress={() => setIsNoteModalVisible(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteInput}
              multiline={true}
              placeholder="Tulis catatan..."
              placeholderTextColor={theme.lightGray}
              textAlignVertical="top"
              value={noteText}
              onChangeText={setNoteText}
            />
            <TouchableOpacity
              style={[styles.modalButton, { marginTop: 16 }]}
              onPress={saveNotes}
              disabled={isSavingNote}
            >
              {isSavingNote ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.modalButtonText}>Simpan Catatan</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isTimerModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={styles.modalTitle}>Atur Waktu (Menit)</Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="numeric"
              value={customMinutes}
              onChangeText={setCustomMinutes}
              placeholder="Contoh: 15"
              placeholderTextColor={theme.lightGray}
              maxLength={3}
            />
            <View
              style={{
                flexDirection: "row",
                width: "100%",
                gap: 12,
                marginTop: 24,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    flex: 1,
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.lightGray,
                  },
                ]}
                onPress={() => setIsTimerModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Batal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1 }]}
                onPress={() => {
                  const mins = parseInt(customMinutes);
                  if (mins && mins > 0) {
                    setInitialTime(mins * 60);
                    setTimeLeft(mins * 60);
                    setIsTimerModalVisible(false);
                  } else {
                    Alert.alert(
                      "Waktu Tidak Valid",
                      "Silakan masukkan angka menit yang benar.",
                    );
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* V3 TASK 2: Modal Bagikan Kutipan */}
      <ShareQuoteModal
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        quoteText={selectedText}
        bookTitle={title}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop:
        Platform.OS === "android" ? (RNStatusBar.currentHeight || 0) + 16 : 48,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.lightGray,
    },
    backButton: { padding: 4 },
    headerTitle: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 16,
      color: theme.text,
      flex: 1,
      textAlign: "center",
      marginHorizontal: 12,
    },
    pdfViewerContainer: {
      flex: 1,
      backgroundColor: theme.background,
      position: "relative",
    },
    stateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    stateText: {
      fontFamily: "Poppins_400Regular",
      marginTop: 12,
      color: theme.text,
    },
    errorTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 18,
      color: theme.text,
      marginBottom: 8,
      textAlign: "center",
    },
    errorDesc: {
      fontFamily: "Lora_400Regular",
      fontSize: 14,
      color: theme.text,
      opacity: 0.7,
      textAlign: "center",
      lineHeight: 22,
    },
    floatingActionContainer: {
      position: "absolute",
      top: 24,
      alignSelf: "center",
      flexDirection: "row",
      gap: 12,
      zIndex: 10,
    },
    floatingHighlightButton: {
      backgroundColor: theme.secondary,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
    floatingShareButton: {
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
    highlightButtonText: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 14,
      color: Colors.light.text,
    },
    timerPillContainer: {
      position: "absolute",
      bottom: Platform.OS === "android" ? 40 : 30,
      alignSelf: "center",
      backgroundColor: theme.surface,
      paddingVertical: 8,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 36,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 10,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    timerPillInfo: { marginRight: 16 },
    timerLabel: {
      fontFamily: "Poppins_400Regular",
      fontSize: 10,
      color: theme.text,
      opacity: 0.7,
    },
    timerValue: {
      fontFamily: "Poppins_700Bold",
      fontSize: 20,
      color: theme.text,
      marginRight: 4,
    },
    playButton: {
      backgroundColor: theme.primary,
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    pauseButton: {
      backgroundColor: theme.secondary,
      shadowColor: theme.secondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 32,
      alignItems: "center",
      width: "100%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10,
    },
    modalTitle: {
      fontFamily: "Poppins_700Bold",
      fontSize: 24,
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    modalText: {
      fontFamily: "Lora_400Regular",
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
      opacity: 0.8,
      lineHeight: 24,
      marginBottom: 32,
    },
    modalButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      width: "100%",
      alignItems: "center",
    },
    modalButtonText: {
      fontFamily: "Poppins_600SemiBold",
      color: "#FFF",
      fontSize: 16,
    },
    fabTTS: {
      position: "absolute",
      bottom: Platform.OS === "android" ? 106 : 90, // Positioned above fabNotes (56 height + 10 margin + 40 bottom)
      right: 24,
      backgroundColor: theme.secondary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    fabNotes: {
      position: "absolute",
      bottom: Platform.OS === "android" ? 40 : 24,
      right: 24,
      backgroundColor: theme.secondary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    noteHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 16,
    },
    noteInput: {
      flex: 1,
      width: "100%",
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      fontFamily: "Lora_400Regular",
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.lightGray,
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
    },
  });
