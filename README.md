# 📖 Fokus Baca

**Fokus Baca** adalah aplikasi mobile reading habit tracker yang membantu kamu membangun kebiasaan membaca secara konsisten. Upload buku PDF/EPUB, baca langsung di aplikasi, dan lacak progres membaca harianmu!

## ✨ Fitur Utama

- 📚 **Perpustakaan Digital** — Upload & kelola koleksi buku PDF/EPUB
- 📖 **PDF Reader** — Baca buku PDF langsung di aplikasi dengan native rendering
- 📊 **Statistik Membaca** — Lacak waktu membaca, halaman dibaca, dan progress buku
- 🌙 **Dark Mode** — Nyaman membaca di malam hari
- 🔔 **Pengingat Harian** — Notifikasi push untuk mengingatkan jadwal membaca
- 🔗 **Share Quote** — Bagikan kutipan favorit sebagai gambar cantik
- 🔊 **Text-to-Speech** — Fitur baca lantang untuk EPUB
- ☁️ **Cloud Sync** — Sinkronisasi data otomatis via Firebase
- 📴 **Offline Support** — Buku tetap bisa dibaca tanpa internet

## 🛠️ Tech Stack

| Teknologi | Kegunaan |
|---|---|
| [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 54) | Framework |
| [Expo Router](https://docs.expo.dev/router/introduction/) | File-based routing |
| [Firebase](https://firebase.google.com/) | Authentication & Firestore DB |
| [Cloudinary](https://cloudinary.com/) | Cloud storage untuk PDF/EPUB & gambar |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management |
| [react-native-pdf](https://github.com/wonday/react-native-pdf) | PDF rendering |

## 🚀 Cara Memulai

### Prasyarat

- [Node.js](https://nodejs.org/) (v18 atau lebih baru)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Akun [Firebase](https://console.firebase.google.com/) (untuk backend)
- Akun [Cloudinary](https://cloudinary.com/) (untuk penyimpanan file)

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/fokus-baca.git
cd fokus-baca
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Salin file template environment dan isi dengan credentials milikmu:

```bash
cp .env.example .env
```

Buka file `.env` lalu isi semua value dengan konfigurasi dari Firebase Console dan Cloudinary Dashboard kamu:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Cloudinary Configuration
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset
```

#### Cara Mendapatkan Firebase Credentials:

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru atau pilih project yang sudah ada
3. Pergi ke **Project Settings** > **General**
4. Scroll ke bawah ke **Your apps** > Klik icon Web (`</>`)
5. Register app dan salin `firebaseConfig` yang muncul

#### Cara Mendapatkan Cloudinary Credentials:

1. Daftar di [Cloudinary](https://cloudinary.com/)
2. Buka **Dashboard** untuk mendapatkan **Cloud Name**
3. Pergi ke **Settings** > **Upload** > buat **Upload Preset** (set ke `Unsigned`)

### 4. Setup Firebase Services

Aktifkan layanan berikut di Firebase Console:

- **Authentication** → Aktifkan provider **Email/Password**
- **Cloud Firestore** → Buat database (pilih region terdekat)

### 5. Jalankan Aplikasi

```bash
npx expo start
```

Pilih salah satu opsi:
- Scan QR code dengan **Expo Go** di HP kamu
- Tekan `a` untuk Android Emulator
- Tekan `i` untuk iOS Simulator

## 📁 Struktur Project

```
fokus-baca/
├── app/                    # Halaman-halaman (file-based routing)
│   ├── (tabs)/             # Tab navigation
│   │   ├── index.tsx       # Home - Perpustakaan buku
│   │   ├── explore.tsx     # Statistik & progress
│   │   └── settings.tsx    # Pengaturan akun & preferensi
│   ├── reader.tsx          # Halaman baca buku
│   ├── login.tsx           # Halaman login
│   └── register.tsx        # Halaman registrasi
├── components/             # Komponen reusable
├── config/                 # Konfigurasi Firebase
├── constants/              # Warna & tema
├── hooks/                  # Custom React hooks
├── services/               # Service modules (Cloudinary, Notifikasi)
├── store/                  # Zustand state management
└── assets/                 # Gambar & ikon
```

## 🔐 Keamanan

> ⚠️ **PENTING**: File `.env` yang berisi API keys **TIDAK** di-push ke repository ini.
> Pastikan kamu membuat file `.env` sendiri berdasarkan `.env.example` sebelum menjalankan aplikasi.

## 📱 Build APK (Opsional)

Untuk membuat APK yang bisa di-install langsung:

```bash
npx eas build --platform android --profile preview
```

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. **Fork** repository ini
2. Buat **branch** fitur baru (`git checkout -b fitur/fitur-keren`)
3. **Commit** perubahanmu (`git commit -m 'Menambahkan fitur keren'`)
4. **Push** ke branch (`git push origin fitur/fitur-keren`)
5. Buat **Pull Request**

## 📄 Lisensi

Project ini menggunakan lisensi [MIT](LICENSE).

---

<p align="center">
  Dibuat dengan ❤️ untuk para pembaca Indonesia
</p>
