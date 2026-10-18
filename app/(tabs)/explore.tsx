// app/(tabs)/explore.tsx

import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  Alert,
} from "react-native";
import { auth, db } from "../../config/firebase";
import { Colors } from "../../constants/Colors";
import { useBookStore } from "../../store/useBookStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartPoint {
  label: string;
  value: number;
  sublabel?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  point: ChartPoint | null;
  unit: string;
}

type ChartType = "time" | "pages" | "speed";

interface BookStat {
  bookId: string;
  bookTitle: string;
  totalMinutes: number;
  totalSessions: number;
  totalPages: number;
  avgSpeed: number;
}

interface PersonalRecords {
  longestSessionMin: number;
  longestSessionDate: string;
  mostProductiveDayMin: number;
  mostProductiveDayDate: string;
  bestStreakAllTime: number;
  avgReadingSpeed: number;
}

interface TimeDistribution {
  morning: number;   // 05-11
  afternoon: number; // 12-17
  evening: number;   // 18-22
  night: number;     // 23-04
}

// ─── Custom Line Chart ────────────────────────────────────────────────────────
const CHART_H = 160;
const DOT_R = 5;
const PADDING_H = 28;
const PADDING_V_TOP = 24;
const PADDING_V_BOTTOM = 28;

function CustomLineChart({
  data,
  color,
  unit,
  theme,
}: {
  data: ChartPoint[];
  color: string;
  unit: string;
  theme: any;
}) {
  const screenW = Dimensions.get("window").width;
  const chartW = screenW - 48 - 32;
  const plotW = chartW - PADDING_H * 2;
  const plotH = CHART_H - PADDING_V_TOP - PADDING_V_BOTTOM;

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    point: null,
    unit,
  });
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = (px: number, py: number, point: ChartPoint) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip({ visible: true, x: px, y: py, point, unit });
    tooltipTimer.current = setTimeout(() => {
      setTooltip((t) => ({ ...t, visible: false }));
    }, 2500);
  };

  const hideTooltip = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip((t) => ({ ...t, visible: false }));
  };

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

  if (!data || data.length === 0) {
    return (
      <View style={{ height: CHART_H, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="bar-chart-outline" size={32} color={theme.lightGray} />
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: theme.text, opacity: 0.5, marginTop: 8 }}>
          Belum ada data
        </Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = PADDING_H + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = PADDING_V_TOP + plotH - ((d.value - minVal) / range) * plotH;
    return { x, y, d };
  });

  const segments: { cx: number; cy: number; len: number; angle: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push({ cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2, len, angle });
  }

  const yGuides = [0, 0.5, 1].map((pct) => ({
    y: PADDING_V_TOP + plotH - pct * plotH,
    val: Math.round(minVal + pct * range),
  }));

  return (
    <View style={{ height: CHART_H + PADDING_V_BOTTOM, width: "100%", position: "relative" }}>
      {yGuides.map((g, i) => (
        <View key={i} style={{ position: "absolute", top: g.y, left: PADDING_H - 4, right: 0, height: 1, backgroundColor: theme.lightGray, opacity: 0.4 }} />
      ))}
      {yGuides.map((g, i) => (
        <Text key={`yl${i}`} style={{ position: "absolute", top: g.y - 8, left: 0, width: PADDING_H - 6, fontSize: 9, fontFamily: "Poppins_400Regular", color: theme.text, opacity: 0.5, textAlign: "right" }}>
          {g.val}
        </Text>
      ))}
      {segments.map((seg, i) => (
        <View key={`seg${i}`} style={{ position: "absolute", top: seg.cy - 1, left: seg.cx - seg.len / 2, width: seg.len, height: 2, backgroundColor: color, opacity: 0.75, transform: [{ rotate: `${seg.angle}deg` }] }} />
      ))}
      {points.map((p, i) => (
        <TouchableOpacity key={`dot${i}`} onPress={() => showTooltip(p.x, p.y, p.d)} style={{ position: "absolute", top: p.y - DOT_R * 2, left: p.x - DOT_R * 2, width: DOT_R * 4, height: DOT_R * 4, justifyContent: "center", alignItems: "center" }} activeOpacity={0.7}>
          <View style={{ width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R, backgroundColor: color, borderWidth: 2, borderColor: theme.surface }} />
        </TouchableOpacity>
      ))}
      {points.map((p, i) => (
        <Text key={`xl${i}`} style={{ position: "absolute", top: CHART_H, left: p.x - 20, width: 40, fontSize: 9, fontFamily: "Poppins_400Regular", color: theme.text, opacity: 0.6, textAlign: "center" }} numberOfLines={1}>
          {p.d.label}
        </Text>
      ))}
      {tooltip.visible && tooltip.point && (
        <TouchableOpacity onPress={hideTooltip} activeOpacity={0.9} style={{ position: "absolute", top: Math.max(2, tooltip.y - 54), left: Math.min(Math.max(0, tooltip.x - 52), chartW - 110), backgroundColor: theme.text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, zIndex: 100, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 6, minWidth: 90, alignItems: "center" }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 13, color: theme.surface }}>{tooltip.point.value} {tooltip.unit}</Text>
          <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 10, color: theme.surface, opacity: 0.8 }}>{tooltip.point.sublabel || tooltip.point.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Heatmap Calendar Component ───────────────────────────────────────────────
function HeatmapCalendar({ heatmapData, weeks, theme }: { heatmapData: Map<string, number>; weeks: number; theme: any }) {
  const today = new Date();
  const screenW = Dimensions.get("window").width;
  const availW = screenW - 48 - 32;
  const cellSize = Math.floor((availW - (weeks - 1) * 3) / weeks);
  const clampedCell = Math.max(10, Math.min(cellSize, 18));

  // Build week grid
  const dayMs = 86400000;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startMs = todayStart - (weeks * 7 - 1) * dayMs;

  const grid: { dateStr: string; minutes: number; dayOfWeek: number }[][] = [];
  let currentWeek: { dateStr: string; minutes: number; dayOfWeek: number }[] = [];

  // Fill leading empty days for first week alignment
  const startDate = new Date(startMs);
  const startDow = startDate.getDay(); // 0=Sun
  for (let pad = 0; pad < startDow; pad++) {
    currentWeek.push({ dateStr: "", minutes: -1, dayOfWeek: pad });
  }

  for (let i = 0; i < weeks * 7 - startDow; i++) {
    const d = new Date(startMs + i * dayMs);
    if (d.getTime() > todayStart) break;
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const minutes = heatmapData.get(dStr) || 0;
    const dow = d.getDay();
    currentWeek.push({ dateStr: dStr, minutes, dayOfWeek: dow });
    if (dow === 6 || i === weeks * 7 - startDow - 1) {
      grid.push(currentWeek);
      currentWeek = [];
    }
  }

  const maxMin = Math.max(...Array.from(heatmapData.values()), 1);

  const getColor = (minutes: number) => {
    if (minutes <= 0) return theme.background;
    const intensity = Math.min(minutes / maxMin, 1);
    if (intensity < 0.25) return `${theme.primary}40`;
    if (intensity < 0.5) return `${theme.primary}80`;
    if (intensity < 0.75) return `${theme.primary}BB`;
    return theme.primary;
  };

  const dayLabels = ["Min", "", "Sel", "", "Kam", "", "Sab"];

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      {/* Day labels */}
      <View style={{ marginRight: 4, paddingTop: 2 }}>
        {dayLabels.map((label, i) => (
          <View key={i} style={{ height: clampedCell, marginBottom: 3, justifyContent: "center" }}>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 8, color: theme.text, opacity: 0.5, width: 20, textAlign: "right" }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      {/* Cells */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row" }}>
          {grid.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "column", marginRight: 3 }}>
              {week.map((day, di) => (
                <View key={di} style={{ width: clampedCell, height: clampedCell, borderRadius: 3, backgroundColor: day.minutes < 0 ? "transparent" : getColor(day.minutes), marginBottom: 3, opacity: day.dateStr === "" ? 0 : 1 }} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Time Distribution Bar ─────────────────────────────────────────────────
function TimeDistributionBar({ dist, theme }: { dist: TimeDistribution; theme: any }) {
  const total = dist.morning + dist.afternoon + dist.evening + dist.night || 1;
  const slots = [
    { label: "Pagi", key: "morning" as const, icon: "sunny-outline", color: "#FFB347" },
    { label: "Siang", key: "afternoon" as const, icon: "partly-sunny-outline", color: "#4FC3F7" },
    { label: "Malam", key: "evening" as const, icon: "moon-outline", color: "#9B59B6" },
    { label: "Dini", key: "night" as const, icon: "star-outline", color: "#2C3E50" },
  ];
  return (
    <View>
      <View style={{ flexDirection: "row", borderRadius: 8, overflow: "hidden", height: 14, marginBottom: 12 }}>
        {slots.map((s) => {
          const pct = (dist[s.key] / total) * 100;
          return pct > 0 ? (
            <View key={s.key} style={{ width: `${pct}%`, backgroundColor: s.color }} />
          ) : null;
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {slots.map((s) => {
          const pct = Math.round((dist[s.key] / total) * 100);
          return (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", minWidth: "45%" }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color, marginRight: 6 }} />
              <Ionicons name={s.icon as any} size={12} color={theme.text} style={{ opacity: 0.7, marginRight: 4 }} />
              <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: theme.text, opacity: 0.8 }}>
                {s.label}: <Text style={{ fontFamily: "Poppins_600SemiBold" }}>{dist[s.key]} mnt</Text> ({pct}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const colorScheme = useColorScheme();
  const storeDarkMode = useBookStore((state) => state.isDarkMode);
  const isDark = storeDarkMode !== null ? storeDarkMode : colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const styles = getStyles(theme);

  // ── Existing State ──
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [tierInfo, setTierInfo] = useState({ name: "Pemula", color: "#cd7f32", icon: "star", next: 3, progress: 0 });
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState(15);
  const [todayMinutesRead, setTodayMinutesRead] = useState(0);
  const [chartType, setChartType] = useState<ChartType>("time");
  const [dailyChartData, setDailyChartData] = useState<ChartPoint[]>([]);
  const [sessionChartData, setSessionChartData] = useState<ChartPoint[]>([]);
  const [speedChartData, setSpeedChartData] = useState<ChartPoint[]>([]);
  const [showChartDropdown, setShowChartDropdown] = useState(false);

  // ── New Statistics State ──
  const [personalRecords, setPersonalRecords] = useState<PersonalRecords>({
    longestSessionMin: 0, longestSessionDate: "-",
    mostProductiveDayMin: 0, mostProductiveDayDate: "-",
    bestStreakAllTime: 0, avgReadingSpeed: 0,
  });
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [bookStats, setBookStats] = useState<BookStat[]>([]);
  const [timeDistribution, setTimeDistribution] = useState<TimeDistribution>({ morning: 0, afternoon: 0, evening: 0, night: 0 });
  const [targetAchievementRate, setTargetAchievementRate] = useState(0);
  const [targetAchievementDays, setTargetAchievementDays] = useState({ achieved: 0, total: 0 });

  // ── Consistency Section Dropdown ──
  const [consistencyView, setConsistencyView] = useState<"target" | "time">("target");
  const [showConsistencyDropdown, setShowConsistencyDropdown] = useState(false);

  // ── "Lihat Selengkapnya" Modals ──
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showBookStatsModal, setShowBookStatsModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // ── Tier Calculator ──
  const calculateTier = (streak: number) => {
    let tier = { name: "Pembaca Pemula", color: "#cd7f32", icon: "star", next: 3 };
    if (streak >= 30) tier = { name: "Legenda Literasi", color: "#9b5de5", icon: "diamond", next: 999 };
    else if (streak >= 15) tier = { name: "Master Fokus", color: "#00bbf9", icon: "trophy", next: 30 };
    else if (streak >= 7) tier = { name: "Sarjana", color: "#ffd166", icon: "medal", next: 15 };
    else if (streak >= 3) tier = { name: "Kutu Buku", color: "#c0c0c0", icon: "book", next: 7 };

    let progress = 100;
    if (tier.next !== 999) {
      let prevTierMin = 0;
      if (tier.next === 30) prevTierMin = 15;
      else if (tier.next === 15) prevTierMin = 7;
      else if (tier.next === 7) prevTierMin = 3;
      progress = ((streak - prevTierMin) / (tier.next - prevTierMin)) * 100;
    }
    setTierInfo({ ...tier, progress });
  };

  useEffect(() => {
    const fetchDailyTarget = async () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists() && userDoc.data().dailyTarget) {
            setDailyTargetMinutes(userDoc.data().dailyTarget);
          }
        } catch (error) {}
      }
    };
    fetchDailyTarget();

    const q = query(collection(db, "reading_sessions"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let totalSeconds = 0;
      let sessionCount = 0;
      const readingDates = new Set<string>();
      let secondsReadToday = 0;

      const today = new Date();
      const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
      const currentUid = auth.currentUser?.uid;

      const allSessions: {
        dateStr: string;
        durationSeconds: number;
        pagesRead: number;
        bookTitle: string;
        bookId?: string;
        dateObj: Date;
        hour: number;
      }[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.userId && data.userId === currentUid) {
          if (data.durationSeconds) totalSeconds += data.durationSeconds;
          sessionCount += 1;

          if (data.date) {
            const d = data.date.toDate();
            const localDateStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
            readingDates.add(localDateStr);

            if (localDateStr === todayStr && data.durationSeconds) {
              secondsReadToday += data.durationSeconds;
            }

            allSessions.push({
              dateStr: localDateStr,
              durationSeconds: data.durationSeconds || 0,
              pagesRead: data.pagesRead || 0,
              bookTitle: data.bookTitle || "Buku",
              bookId: data.bookId,
              dateObj: d,
              hour: d.getHours(),
            });
          }
        }
      });

      setTotalMinutes(Math.floor(totalSeconds / 60));
      setTotalSessions(sessionCount);
      setTodayMinutesRead(Math.floor(secondsReadToday / 60));

      // ── Daily Chart (last 7 days) ──
      const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
      const last7: ChartPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
        const daySeconds = allSessions.filter((s) => s.dateStr === dStr).reduce((acc, s) => acc + s.durationSeconds, 0);
        last7.push({ label: dayNames[d.getDay()], value: Math.round(daySeconds / 60), sublabel: dStr });
      }
      setDailyChartData(last7);

      // ── Session Chart (last 10 sessions pages) ──
      const sortedSessions = [...allSessions].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).slice(-10);
      setSessionChartData(sortedSessions.map((s, i) => ({
        label: `S${i + 1}`,
        value: s.pagesRead,
        sublabel: s.bookTitle.replace(/\.[^.]+$/, "").slice(0, 20),
      })));

      // ── Speed Chart (HPM per sesi - last 10) ──
      setSpeedChartData(sortedSessions.map((s, i) => {
        const durationMin = s.durationSeconds / 60;
        const speed = durationMin > 0 && s.pagesRead > 0 ? Math.round((s.pagesRead / durationMin) * 10) / 10 : 0;
        return { label: `S${i + 1}`, value: speed, sublabel: s.bookTitle.replace(/\.[^.]+$/, "").slice(0, 20) };
      }));

      // ── Streak Calculation ──
      const sortedDates = Array.from(readingDates).sort((a, b) => b.localeCompare(a));
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000).toISOString().split("T")[0];

      let streakCount = 0;
      let checkDate = new Date(today);
      let checkDateStr = todayStr;

      if (sortedDates.includes(todayStr)) {
        // ok
      } else if (sortedDates.includes(yesterdayStr)) {
        checkDate = yesterday;
        checkDateStr = yesterdayStr;
      } else {
        setCurrentStreak(0);
        calculateTier(0);
      }

      if (sortedDates.includes(checkDateStr)) {
        while (sortedDates.includes(checkDateStr)) {
          streakCount++;
          checkDate.setDate(checkDate.getDate() - 1);
          checkDateStr = new Date(checkDate.getTime() - checkDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
        }
        setCurrentStreak(streakCount);
        calculateTier(streakCount);
      }

      // ── Best Streak All-Time ──
      const allDaysSorted = Array.from(readingDates).sort();
      let bestStreak = 0;
      let tempStreak = 0;
      let prevDate: string | null = null;
      for (const dateStr of allDaysSorted) {
        if (prevDate) {
          const prevDateObj: Date = new Date(prevDate);
          prevDateObj.setDate(prevDateObj.getDate() + 1);
          const expectedStr: string = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, "0")}-${String(prevDateObj.getDate()).padStart(2, "0")}`;
          if (expectedStr === dateStr) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
        prevDate = dateStr;
      }

      // ── Personal Records ──
      let longestSec = 0;
      let longestDate = "-";
      const dayTotals = new Map<string, number>();
      let totalPagesAll = 0;
      let totalSpeedSessions = 0;
      let totalSpeedSum = 0;

      for (const s of allSessions) {
        if (s.durationSeconds > longestSec) {
          longestSec = s.durationSeconds;
          longestDate = s.dateStr;
        }
        dayTotals.set(s.dateStr, (dayTotals.get(s.dateStr) || 0) + s.durationSeconds);
        totalPagesAll += s.pagesRead;
        const durationMin = s.durationSeconds / 60;
        if (durationMin > 0 && s.pagesRead > 0) {
          totalSpeedSum += s.pagesRead / durationMin;
          totalSpeedSessions++;
        }
      }

      let mostProdSec = 0;
      let mostProdDate = "-";
      dayTotals.forEach((secs, dateStr) => {
        if (secs > mostProdSec) {
          mostProdSec = secs;
          mostProdDate = dateStr;
        }
      });

      const avgSpeed = totalSpeedSessions > 0 ? Math.round((totalSpeedSum / totalSpeedSessions) * 10) / 10 : 0;
      setPersonalRecords({
        longestSessionMin: Math.round(longestSec / 60),
        longestSessionDate: longestDate,
        mostProductiveDayMin: Math.round(mostProdSec / 60),
        mostProductiveDayDate: mostProdDate,
        bestStreakAllTime: bestStreak,
        avgReadingSpeed: avgSpeed,
      });

      // ── Heatmap Data (last 52 weeks) ──
      const hmap = new Map<string, number>();
      for (const s of allSessions) {
        hmap.set(s.dateStr, (hmap.get(s.dateStr) || 0) + Math.round(s.durationSeconds / 60));
      }
      setHeatmapData(hmap);

      // ── Book Stats ──
      const bookMap = new Map<string, { title: string; totalSec: number; sessions: number; pages: number }>();
      for (const s of allSessions) {
        const key = s.bookTitle;
        const existing = bookMap.get(key) || { title: s.bookTitle, totalSec: 0, sessions: 0, pages: 0 };
        existing.totalSec += s.durationSeconds;
        existing.sessions += 1;
        existing.pages += s.pagesRead;
        bookMap.set(key, existing);
      }
      const bookStatsList: BookStat[] = Array.from(bookMap.values()).map((b) => {
        const durationMin = b.totalSec / 60;
        return {
          bookId: b.title,
          bookTitle: b.title.replace(/\.[^.]+$/, ""),
          totalMinutes: Math.round(durationMin),
          totalSessions: b.sessions,
          totalPages: b.pages,
          avgSpeed: durationMin > 0 && b.pages > 0 ? Math.round((b.pages / durationMin) * 10) / 10 : 0,
        };
      }).sort((a, b) => b.totalMinutes - a.totalMinutes);
      setBookStats(bookStatsList);

      // ── Time Distribution ──
      const dist: TimeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      for (const s of allSessions) {
        const h = s.hour;
        const min = Math.round(s.durationSeconds / 60);
        if (h >= 5 && h < 12) dist.morning += min;
        else if (h >= 12 && h < 18) dist.afternoon += min;
        else if (h >= 18 && h < 23) dist.evening += min;
        else dist.night += min;
      }
      setTimeDistribution(dist);

      // ── Target Achievement Rate (last 30 days) ──
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      let achievedDays = 0;
      let totalCheckDays = 0;
      const dailyTarget = (await getDoc(doc(db, "users", currentUid || "")).catch(() => null))?.data()?.dailyTarget || 15;
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        if (d.getTime() > today.getTime()) break;
        const dStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
        const dayMin = (dayTotals.get(dStr) || 0) / 60;
        totalCheckDays++;
        if (dayMin >= dailyTarget) achievedDays++;
      }
      setTargetAchievementDays({ achieved: achievedDays, total: totalCheckDays });
      setTargetAchievementRate(totalCheckDays > 0 ? Math.round((achievedDays / totalCheckDays) * 100) : 0);
    });

    return () => unsubscribe();
  }, []);

  const dailyProgressPercent = Math.min((todayMinutesRead / dailyTargetMinutes) * 100, 100);

  const handleResetStats = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert("Gagal", "Anda harus login untuk mereset statistik.");
      return;
    }
    Alert.alert("Peringatan Keras!", "Apakah Anda yakin ingin menghapus SEMUA statistik membaca Anda? Data yang telah dihapus tidak dapat dikembalikan lagi.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus Permanen",
        style: "destructive",
        onPress: async () => {
          try {
            const qDelete = query(collection(db, "reading_sessions"), where("userId", "==", uid));
            const querySnapshot = await getDocs(qDelete);
            await Promise.all(querySnapshot.docs.map((d) => deleteDoc(d.ref)));
            Alert.alert("Sukses", "Statistik membaca Anda telah direset.");
          } catch (error) {
            Alert.alert("Error", "Gagal mereset statistik.");
          }
        },
      },
    ]);
  };

  // Chart config
  const chartConfigs = {
    time: { data: dailyChartData, unit: "mnt", color: theme.primary, title: "Waktu Baca Harian", sub: "7 hari terakhir" },
    pages: { data: sessionChartData, unit: "hal", color: theme.secondary, title: "Halaman Per Sesi", sub: "10 sesi terakhir" },
    speed: { data: speedChartData, unit: "HPM", color: "#FF6B6B", title: "Kecepatan Baca", sub: "10 sesi terakhir" },
  };
  const currentChart = chartConfigs[chartType];

  // Favorite time of day
  const timeKeys: (keyof TimeDistribution)[] = ["morning", "afternoon", "evening", "night"];
  const timeLabels: Record<keyof TimeDistribution, string> = { morning: "Pagi (05-11)", afternoon: "Siang (12-17)", evening: "Malam (18-22)", night: "Dini Hari (23-04)" };
  const favoriteTime = timeKeys.reduce((best, key) => timeDistribution[key] > timeDistribution[best] ? key : best, "morning" as keyof TimeDistribution);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <View style={styles.header}>
        <Text style={styles.title}>Statistik</Text>
        <Text style={styles.subtitle}>Pantau seberapa jauh komitmenmu.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── 1. Target Harian ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Target Hari Ini</Text>
              <Text style={styles.cardSub}>{todayMinutesRead} / {dailyTargetMinutes} Menit</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: todayMinutesRead >= dailyTargetMinutes ? "#4CAF5020" : theme.background }]}>
              <Ionicons name={todayMinutesRead >= dailyTargetMinutes ? "checkmark-circle" : "time-outline"} size={16} color={todayMinutesRead >= dailyTargetMinutes ? "#4CAF50" : theme.primary} />
              <Text style={[styles.badgeText, { color: todayMinutesRead >= dailyTargetMinutes ? "#4CAF50" : theme.primary }]}>
                {Math.round(dailyProgressPercent)}%
              </Text>
            </View>
          </View>
          <View style={styles.barBackground}>
            <View style={[styles.barFill, { width: `${dailyProgressPercent}%`, backgroundColor: todayMinutesRead >= dailyTargetMinutes ? "#4CAF50" : theme.primary }]} />
          </View>
          {todayMinutesRead >= dailyTargetMinutes && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={[styles.successText, { marginTop: 0, marginLeft: 6 }]}>Target tercapai! Luar biasa!</Text>
            </View>
          )}
        </View>

        {/* ─── 2. Ringkasan Cepat (4 mini-cards) ─── */}
        <View style={styles.miniCardGrid}>
          <View style={[styles.miniCard, { borderLeftColor: theme.primary }]}>
            <Ionicons name="time-outline" size={20} color={theme.primary} />
            <Text style={styles.miniCardValue}>{totalMinutes}</Text>
            <Text style={styles.miniCardLabel}>Total Menit</Text>
          </View>
          <View style={[styles.miniCard, { borderLeftColor: theme.secondary }]}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={theme.secondary} />
            <Text style={styles.miniCardValue}>{totalSessions}</Text>
            <Text style={styles.miniCardLabel}>Total Sesi</Text>
          </View>
          <View style={[styles.miniCard, { borderLeftColor: "#FF6B6B" }]}>
            <Ionicons name="flash-outline" size={20} color="#FF6B6B" />
            <Text style={styles.miniCardValue}>{personalRecords.avgReadingSpeed}</Text>
            <Text style={styles.miniCardLabel}>Rata HPM</Text>
          </View>
          <View style={[styles.miniCard, { borderLeftColor: "#9b5de5" }]}>
            <Ionicons name="flame-outline" size={20} color="#9b5de5" />
            <Text style={styles.miniCardValue}>{personalRecords.bestStreakAllTime}</Text>
            <Text style={styles.miniCardLabel}>Rekor Streak</Text>
          </View>
        </View>

        {/* ─── 3. Grafik Aktivitas (dengan dropdown 3 pilihan) ─── */}
        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <View style={styles.cardHeaderRow2}>
            <View>
              <Text style={styles.cardTitle}>{currentChart.title}</Text>
              <Text style={styles.cardSub}>{currentChart.sub}</Text>
            </View>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowChartDropdown(true)} activeOpacity={0.7}>
              <Text style={styles.dropdownTriggerText}>
                {chartType === "time" ? "Waktu" : chartType === "pages" ? "Halaman" : "Kecepatan"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.chartDivider} />
          <View style={styles.chartArea}>
            <CustomLineChart data={currentChart.data} color={currentChart.color} unit={currentChart.unit} theme={theme} />
          </View>
        </View>

        {/* ─── 4. Tier & Streak Card ─── */}
        <View style={[styles.card, { borderWidth: 2, borderColor: tierInfo.color }]}>
          <View style={styles.tierHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierLabel}>Gelar Anda Saat Ini</Text>
              <Text style={[styles.tierName, { color: tierInfo.color }]}>{tierInfo.name}</Text>
            </View>
            <Ionicons name={tierInfo.icon as any} size={40} color={tierInfo.color} />
          </View>
          <View style={styles.streakRow}>
            <View style={styles.streakBlock}>
              <Text style={styles.streakBigNum}>{currentStreak}</Text>
              <Text style={styles.streakSmallLabel}>Streak Saat Ini</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakBlock}>
              <Text style={styles.streakBigNum}>{personalRecords.bestStreakAllTime}</Text>
              <Text style={styles.streakSmallLabel}>Rekor Terbaik</Text>
            </View>
          </View>
          {tierInfo.next !== 999 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.tierProgressLabel}>Menuju Gelar Berikutnya ({tierInfo.next} Hari)</Text>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${tierInfo.progress}%`, backgroundColor: tierInfo.color }]} />
              </View>
            </View>
          )}
        </View>

        {/* ─── 5. Kalender Aktivitas (Heatmap) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Kalender Aktivitas</Text>
              <Text style={styles.cardSub}>12 minggu terakhir</Text>
            </View>
            <TouchableOpacity style={styles.seeMoreBtn} onPress={() => setShowCalendarModal(true)}>
              <Text style={styles.seeMoreText}>Lihat Selengkapnya</Text>
              <Ionicons name="arrow-forward" size={13} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 12 }}>
            <HeatmapCalendar heatmapData={heatmapData} weeks={12} theme={theme} />
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={styles.heatmapLegendLabel}>Sedikit</Text>
            {["40", "80", "BB", "FF"].map((op) => (
              <View key={op} style={[styles.heatmapLegendCell, { backgroundColor: `${theme.primary}${op}` }]} />
            ))}
            <Text style={styles.heatmapLegendLabel}>Banyak</Text>
          </View>
        </View>

        {/* ─── 6. Rekor Pribadi ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Rekor Pribadi</Text>
              <Text style={styles.cardSub}>Pencapaian terbaikmu</Text>
            </View>
            <TouchableOpacity style={styles.seeMoreBtn} onPress={() => setShowRecordsModal(true)}>
              <Text style={styles.seeMoreText}>Lihat Selengkapnya</Text>
              <Ionicons name="arrow-forward" size={13} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.recordsGrid}>
            <View style={styles.recordItem}>
              <View style={[styles.recordIconBg, { backgroundColor: `${theme.primary}20` }]}>
                <Ionicons name="hourglass-outline" size={20} color={theme.primary} />
              </View>
              <Text style={styles.recordValue}>{personalRecords.longestSessionMin} mnt</Text>
              <Text style={styles.recordLabel}>Sesi Terpanjang</Text>
            </View>
            <View style={styles.recordItem}>
              <View style={[styles.recordIconBg, { backgroundColor: "#FF6B6B20" }]}>
                <Ionicons name="flash-outline" size={20} color="#FF6B6B" />
              </View>
              <Text style={styles.recordValue}>{personalRecords.avgReadingSpeed} HPM</Text>
              <Text style={styles.recordLabel}>Rata-rata Kecepatan</Text>
            </View>
            <View style={styles.recordItem}>
              <View style={[styles.recordIconBg, { backgroundColor: "#ffd16620" }]}>
                <Ionicons name="trophy-outline" size={20} color="#ffd166" />
              </View>
              <Text style={styles.recordValue}>{personalRecords.mostProductiveDayMin} mnt</Text>
              <Text style={styles.recordLabel}>Hari Paling Produktif</Text>
            </View>
          </View>
        </View>

        {/* ─── 7. Statistik Per Buku ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Statistik Per Buku</Text>
              <Text style={styles.cardSub}>{bookStats.length} buku dibaca</Text>
            </View>
            {bookStats.length > 3 && (
              <TouchableOpacity style={styles.seeMoreBtn} onPress={() => setShowBookStatsModal(true)}>
                <Text style={styles.seeMoreText}>Lihat Selengkapnya</Text>
                <Ionicons name="arrow-forward" size={13} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
          {bookStats.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={32} color={theme.lightGray} />
              <Text style={styles.emptyStateText}>Belum ada sesi membaca</Text>
            </View>
          ) : (
            bookStats.slice(0, 3).map((book, idx) => (
              <View key={idx} style={styles.bookStatRow}>
                <View style={[styles.bookRankBadge, { backgroundColor: idx === 0 ? "#ffd166" : idx === 1 ? "#c0c0c0" : "#cd7f32" }]}>
                  <Text style={styles.bookRankText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookStatTitle} numberOfLines={1}>{book.bookTitle}</Text>
                  <Text style={styles.bookStatSub}>{book.totalSessions} sesi · {book.totalPages} hal</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.bookStatValue, { color: theme.primary }]}>{book.totalMinutes} mnt</Text>
                  <Text style={styles.bookStatSpeed}>{book.avgSpeed} HPM</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ─── 8. Konsistensi (Target Achievement + Waktu Favorit dengan Dropdown) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>
                {consistencyView === "target" ? "Pencapaian Target" : "Waktu Baca Favorit"}
              </Text>
              <Text style={styles.cardSub}>
                {consistencyView === "target" ? "30 hari terakhir" : "Distribusi jam membaca"}
              </Text>
            </View>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowConsistencyDropdown(true)} activeOpacity={0.7}>
              <Text style={styles.dropdownTriggerText}>
                {consistencyView === "target" ? "Target" : "Waktu"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {consistencyView === "target" ? (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <Text style={styles.bigStatNum}>{targetAchievementRate}%</Text>
                <View style={{ marginLeft: 16 }}>
                  <Text style={styles.cardSub}>Tingkat Keberhasilan</Text>
                  <Text style={[styles.cardSub, { opacity: 1, color: theme.primary }]}>
                    {targetAchievementDays.achieved} dari {targetAchievementDays.total} hari
                  </Text>
                </View>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${targetAchievementRate}%`, backgroundColor: targetAchievementRate >= 70 ? "#4CAF50" : targetAchievementRate >= 40 ? "#FFB347" : "#E76F51" }]} />
              </View>
              <Text style={[styles.cardSub, { marginTop: 8, opacity: 0.8 }]}>
                {targetAchievementRate >= 80 ? "Konsistensi luar biasa!" : targetAchievementRate >= 50 ? "Terus tingkatkan konsistensimu!" : "Yuk, bangun kebiasaan membaca lebih rutin!"}
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <View style={[styles.badgeChip, { alignSelf: "flex-start", marginBottom: 12, backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="star" size={14} color={theme.primary} />
                <Text style={[styles.badgeText, { color: theme.primary }]}>Favorit: {timeLabels[favoriteTime]}</Text>
              </View>
              <TimeDistributionBar dist={timeDistribution} theme={theme} />
            </View>
          )}
        </View>

        {/* ─── Reset Button ─── */}
        <TouchableOpacity style={styles.resetButton} onPress={handleResetStats}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={styles.resetButtonText}>Reset Statistik</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ─── Dropdown: Grafik ─── */}
      <Modal transparent animationType="fade" visible={showChartDropdown} onRequestClose={() => setShowChartDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowChartDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Pilih Grafik</Text>
            {([
              { key: "time", label: "Waktu Baca Harian", icon: "time-outline", sub: "7 hari terakhir" },
              { key: "pages", label: "Halaman Per Sesi", icon: "book-outline", sub: "10 sesi terakhir" },
              { key: "speed", label: "Kecepatan Baca (HPM)", icon: "flash-outline", sub: "10 sesi terakhir" },
            ] as const).map((opt) => (
              <TouchableOpacity key={opt.key} style={[styles.dropdownOption, chartType === opt.key && styles.dropdownOptionActive]} onPress={() => { setChartType(opt.key); setShowChartDropdown(false); }} activeOpacity={0.7}>
                <Ionicons name={opt.icon} size={18} color={chartType === opt.key ? theme.primary : theme.text} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownOptionText, chartType === opt.key && { color: theme.primary, fontFamily: "Poppins_600SemiBold" }]}>{opt.label}</Text>
                  <Text style={[styles.dropdownOptionSub]}>{opt.sub}</Text>
                </View>
                {chartType === opt.key && <Ionicons name="checkmark" size={16} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Dropdown: Konsistensi ─── */}
      <Modal transparent animationType="fade" visible={showConsistencyDropdown} onRequestClose={() => setShowConsistencyDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowConsistencyDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Pilih Tampilan Konsistensi</Text>
            {([
              { key: "target", label: "Pencapaian Target Harian", icon: "flag-outline", sub: "30 hari terakhir" },
              { key: "time", label: "Waktu Baca Favorit", icon: "time-outline", sub: "Distribusi jam membaca" },
            ] as const).map((opt) => (
              <TouchableOpacity key={opt.key} style={[styles.dropdownOption, consistencyView === opt.key && styles.dropdownOptionActive]} onPress={() => { setConsistencyView(opt.key); setShowConsistencyDropdown(false); }} activeOpacity={0.7}>
                <Ionicons name={opt.icon} size={18} color={consistencyView === opt.key ? theme.primary : theme.text} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownOptionText, consistencyView === opt.key && { color: theme.primary, fontFamily: "Poppins_600SemiBold" }]}>{opt.label}</Text>
                  <Text style={styles.dropdownOptionSub}>{opt.sub}</Text>
                </View>
                {consistencyView === opt.key && <Ionicons name="checkmark" size={16} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Modal: Rekor Pribadi Detail ─── */}
      <Modal animationType="slide" transparent visible={showRecordsModal} onRequestClose={() => setShowRecordsModal(false)}>
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.fullModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="trophy-outline" size={24} color={theme.primary} />
                <Text style={[styles.fullModalTitle, { marginLeft: 8 }]}>Rekor Pribadi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRecordsModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { icon: "hourglass-outline", color: theme.primary, label: "Sesi Terpanjang", value: `${personalRecords.longestSessionMin} menit`, detail: personalRecords.longestSessionDate !== "-" ? `Tanggal: ${personalRecords.longestSessionDate}` : "Belum ada data" },
                { icon: "calendar-outline", color: "#4CAF50", label: "Hari Paling Produktif", value: `${personalRecords.mostProductiveDayMin} menit`, detail: personalRecords.mostProductiveDayDate !== "-" ? `Tanggal: ${personalRecords.mostProductiveDayDate}` : "Belum ada data" },
                { icon: "flame-outline", color: "#9b5de5", label: "Streak Terpanjang (All-Time)", value: `${personalRecords.bestStreakAllTime} hari`, detail: "Rekor terbaik sepanjang masa" },
                { icon: "flash-outline", color: "#FF6B6B", label: "Rata-rata Kecepatan Baca", value: `${personalRecords.avgReadingSpeed} HPM`, detail: "Halaman per menit seluruh sesi" },
                { icon: "time-outline", color: theme.secondary, label: "Total Waktu Membaca", value: `${totalMinutes} menit`, detail: `Setara ${Math.round(totalMinutes / 60 * 10) / 10} jam membaca` },
                { icon: "checkmark-done-circle-outline", color: "#00bbf9", label: "Total Sesi Selesai", value: `${totalSessions} sesi`, detail: "Sesi yang berhasil diselesaikan" },
              ].map((rec, idx) => (
                <View key={idx} style={styles.recordDetailRow}>
                  <View style={[styles.recordIconBg, { backgroundColor: `${rec.color}20`, width: 48, height: 48 }]}>
                    <Ionicons name={rec.icon as any} size={24} color={rec.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordDetailLabel}>{rec.label}</Text>
                    <Text style={[styles.recordDetailValue, { color: rec.color }]}>{rec.value}</Text>
                    <Text style={styles.recordDetailSub}>{rec.detail}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Kalender Aktivitas Full ─── */}
      <Modal animationType="slide" transparent visible={showCalendarModal} onRequestClose={() => setShowCalendarModal(false)}>
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.fullModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="calendar-outline" size={24} color={theme.primary} />
                <Text style={[styles.fullModalTitle, { marginLeft: 8 }]}>Kalender Aktivitas</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.cardSub, { marginBottom: 8 }]}>52 minggu terakhir (1 tahun)</Text>
            <View style={{ marginTop: 8 }}>
              <HeatmapCalendar heatmapData={heatmapData} weeks={52} theme={theme} />
            </View>
            <View style={[styles.heatmapLegend, { marginTop: 16 }]}>
              <Text style={styles.heatmapLegendLabel}>Sedikit</Text>
              {["40", "80", "BB", "FF"].map((op) => (
                <View key={op} style={[styles.heatmapLegendCell, { backgroundColor: `${theme.primary}${op}` }]} />
              ))}
              <Text style={styles.heatmapLegendLabel}>Banyak</Text>
            </View>
            <View style={{ marginTop: 20 }}>
              <Text style={styles.cardTitle}>Ringkasan Aktivitas</Text>
              <View style={styles.calendarSummaryGrid}>
                <View style={styles.calendarSummaryItem}>
                  <Text style={[styles.miniCardValue, { color: theme.primary }]}>{Array.from(heatmapData.keys()).length}</Text>
                  <Text style={styles.miniCardLabel}>Hari Aktif</Text>
                </View>
                <View style={styles.calendarSummaryItem}>
                  <Text style={[styles.miniCardValue, { color: theme.secondary }]}>{Array.from(heatmapData.values()).reduce((a, b) => a + b, 0)}</Text>
                  <Text style={styles.miniCardLabel}>Total Menit</Text>
                </View>
                <View style={styles.calendarSummaryItem}>
                  <Text style={[styles.miniCardValue, { color: "#ffd166" }]}>{Math.max(...Array.from(heatmapData.values()), 0)}</Text>
                  <Text style={styles.miniCardLabel}>Rekor Harian</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Statistik Per Buku Full ─── */}
      <Modal animationType="slide" transparent visible={showBookStatsModal} onRequestClose={() => setShowBookStatsModal(false)}>
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.fullModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="book-outline" size={24} color={theme.primary} />
                <Text style={[styles.fullModalTitle, { marginLeft: 8 }]}>Statistik Per Buku</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBookStatsModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.cardSub, { marginBottom: 8 }]}>{bookStats.length} buku telah dibaca</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {bookStats.map((book, idx) => (
                <View key={idx} style={[styles.bookStatRow, { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.lightGray }]}>
                  <View style={[styles.bookRankBadge, { backgroundColor: idx === 0 ? "#ffd166" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : theme.lightGray, width: 30, height: 30, borderRadius: 15 }]}>
                    <Text style={[styles.bookRankText, { fontSize: 13 }]}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.bookStatTitle} numberOfLines={2}>{book.bookTitle}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      <View style={[styles.bookStatChip, { backgroundColor: `${theme.primary}15` }]}>
                        <Text style={[styles.bookStatChipText, { color: theme.primary }]}>{book.totalMinutes} mnt</Text>
                      </View>
                      <View style={[styles.bookStatChip, { backgroundColor: `${theme.secondary}15` }]}>
                        <Text style={[styles.bookStatChipText, { color: theme.secondary }]}>{book.totalPages} hal</Text>
                      </View>
                      <View style={[styles.bookStatChip, { backgroundColor: "#FF6B6B15" }]}>
                        <Text style={[styles.bookStatChipText, { color: "#FF6B6B" }]}>{book.avgSpeed} HPM</Text>
                      </View>
                      <View style={[styles.bookStatChip, { backgroundColor: `${theme.lightGray}` }]}>
                        <Text style={[styles.bookStatChipText, { color: theme.text, opacity: 0.7 }]}>{book.totalSessions} sesi</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              {bookStats.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="book-outline" size={48} color={theme.lightGray} />
                  <Text style={styles.emptyStateText}>Belum ada sesi membaca yang tercatat</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
    title: { fontFamily: "Poppins_700Bold", fontSize: 28, color: theme.text },
    subtitle: { fontFamily: "Lora_400Regular", fontSize: 16, color: theme.text, opacity: 0.8, marginTop: 4 },
    content: { paddingHorizontal: 20, paddingBottom: 48 },

    // ── Universal Card ──
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    cardHeaderRow2: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
    },
    cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: theme.text },
    cardSub: { fontFamily: "Lora_400Regular", fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 2 },

    // ── Badges & Chips ──
    badgeChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      gap: 4,
    },
    badgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },

    // ── Progress Bars ──
    barBackground: { width: "100%", height: 10, backgroundColor: theme.background, borderRadius: 5, overflow: "hidden", marginTop: 8 },
    barFill: { height: "100%", borderRadius: 5 },
    successText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#4CAF50", marginTop: 10, textAlign: "center" },

    // ── Mini Card Grid (4 cards) ──
    miniCardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
    miniCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    miniCardValue: { fontFamily: "Poppins_700Bold", fontSize: 24, color: theme.text, marginTop: 8 },
    miniCardLabel: { fontFamily: "Poppins_400Regular", fontSize: 11, color: theme.text, opacity: 0.6, marginTop: 2 },

    // ── Chart ──
    chartDivider: { height: 1, backgroundColor: theme.lightGray },
    chartArea: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, overflow: "hidden" },
    dropdownTrigger: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.lightGray,
    },
    dropdownTriggerText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: theme.primary },

    // ── Tier & Streak ──
    tierHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    tierLabel: { fontFamily: "Poppins_400Regular", fontSize: 12, color: theme.text, opacity: 0.7 },
    tierName: { fontFamily: "Poppins_700Bold", fontSize: 20, marginTop: 2 },
    streakRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    streakBlock: { flex: 1, alignItems: "center" },
    streakBigNum: { fontFamily: "Poppins_700Bold", fontSize: 44, color: theme.text, lineHeight: 52 },
    streakSmallLabel: { fontFamily: "Poppins_400Regular", fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 2 },
    streakDivider: { width: 1, height: 56, backgroundColor: theme.lightGray, marginHorizontal: 16 },
    tierProgressLabel: { fontFamily: "Poppins_400Regular", fontSize: 12, color: theme.text, opacity: 0.7, marginBottom: 4 },

    // ── Heatmap ──
    heatmapLegend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 10, gap: 3 },
    heatmapLegendCell: { width: 12, height: 12, borderRadius: 3 },
    heatmapLegendLabel: { fontFamily: "Poppins_400Regular", fontSize: 10, color: theme.text, opacity: 0.5 },

    // ── See More Button ──
    seeMoreBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
    seeMoreText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: theme.primary },

    // ── Personal Records ──
    recordsGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, gap: 8 },
    recordItem: { flex: 1, alignItems: "center" },
    recordIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 8 },
    recordValue: { fontFamily: "Poppins_700Bold", fontSize: 14, color: theme.text, textAlign: "center" },
    recordLabel: { fontFamily: "Poppins_400Regular", fontSize: 10, color: theme.text, opacity: 0.6, textAlign: "center", marginTop: 2 },

    // ── Book Stats ──
    bookStatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
    bookRankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    bookRankText: { fontFamily: "Poppins_700Bold", fontSize: 12, color: "#FFF" },
    bookStatTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: theme.text },
    bookStatSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: theme.text, opacity: 0.6, marginTop: 2 },
    bookStatValue: { fontFamily: "Poppins_700Bold", fontSize: 14 },
    bookStatSpeed: { fontFamily: "Poppins_400Regular", fontSize: 11, color: theme.text, opacity: 0.6, marginTop: 2 },
    bookStatChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    bookStatChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 11 },

    // ── Big Stat ──
    bigStatNum: { fontFamily: "Poppins_700Bold", fontSize: 48, color: theme.primary, lineHeight: 56 },

    // ── Empty State ──
    emptyState: { alignItems: "center", paddingVertical: 24 },
    emptyStateText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: theme.text, opacity: 0.5, marginTop: 8, textAlign: "center" },

    // ── Reset Button ──
    resetButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8, padding: 16, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: "#FF3B30" },
    resetButtonText: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: "#FF3B30", marginLeft: 8 },

    // ── Dropdown Modal ──
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", paddingBottom: 40 },
    dropdownMenu: { backgroundColor: theme.surface, marginHorizontal: 20, borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
    dropdownMenuTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: theme.text, textAlign: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.lightGray, marginBottom: 4 },
    dropdownOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginVertical: 2 },
    dropdownOptionActive: { backgroundColor: theme.background },
    dropdownOptionText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: theme.text },
    dropdownOptionSub: { fontFamily: "Lora_400Regular", fontSize: 11, color: theme.text, opacity: 0.5, marginTop: 1 },

    // ── Full Modal (slide up) ──
    fullModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    fullModalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      maxHeight: "85%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 12,
    },
    fullModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    fullModalTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: theme.text },
    closeBtn: { padding: 4 },

    // ── Record Detail Row (in modal) ──
    recordDetailRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.lightGray, gap: 16 },
    recordDetailLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: theme.text },
    recordDetailValue: { fontFamily: "Poppins_700Bold", fontSize: 20, marginTop: 2 },
    recordDetailSub: { fontFamily: "Lora_400Regular", fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 4 },

    // ── Calendar Summary in Modal ──
    calendarSummaryGrid: { flexDirection: "row", marginTop: 12, gap: 12 },
    calendarSummaryItem: { flex: 1, backgroundColor: theme.background, borderRadius: 12, padding: 12, alignItems: "center" },
  });
