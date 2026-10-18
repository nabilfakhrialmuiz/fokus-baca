// services/cloudinaryService.ts
// Cloudinary Upload Service untuk menyimpan file PDF/EPUB & gambar ke cloud

// Cloudinary config dibaca dari environment variables (.env file)
// Lihat .env.example untuk template konfigurasi
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const CLOUDINARY_RAW_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
const CLOUDINARY_IMAGE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  original_filename: string;
  bytes: number;
}

/**
 * Upload file PDF/EPUB ke Cloudinary menggunakan unsigned upload preset.
 *
 * @param fileUri - URI lokal file dari DocumentPicker (file:// atau content://)
 * @param fileName - Nama asli file (contoh: "Atomic Habits.pdf")
 * @param mimeType - Tipe MIME file ("application/pdf" atau "application/epub+zip")
 * @returns Object berisi secure_url dan public_id dari Cloudinary
 */
export async function uploadToCloudinary(
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();

  // FormData di React Native menerima object dengan uri, type, dan name
  formData.append("file", {
    uri: fileUri,
    type: mimeType,
    name: fileName,
  } as any);

  formData.append("upload_preset", UPLOAD_PRESET);

  const uploadUrl = mimeType === "application/pdf" ? CLOUDINARY_IMAGE_URL : CLOUDINARY_RAW_URL;

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      errorData?.error?.message || `Upload gagal (status ${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    original_filename: data.original_filename,
    bytes: data.bytes,
  };
}

/**
 * Menghasilkan URL sampul buku dari public_id PDF yang sudah di-upload ke Cloudinary.
 * Cloudinary dapat me-render halaman pertama PDF menjadi gambar secara otomatis.
 *
 * @param publicId - public_id hasil upload PDF ke Cloudinary
 * @returns URL gambar sampul buku (halaman 1 PDF) dalam format JPG
 */
export function generatePdfCoverUrl(publicId: string): string {
  // Cloudinary transformation: ambil halaman 1, resize jadi thumbnail buku (width 300)
  // Format: /image/upload/<transformations>/<public_id>.jpg
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_300,h_400,c_fill,pg_1,f_jpg,q_auto/${publicId}.jpg`;
}

/**
 * Upload gambar (foto profil) ke Cloudinary.
 *
 * @param fileUri - URI lokal gambar dari ImagePicker
 * @param fileName - Nama file gambar
 * @returns Object berisi secure_url dan public_id dari Cloudinary
 */
export async function uploadImageToCloudinary(
  fileUri: string,
  fileName: string,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();

  // Deteksi extension untuk menentukan mime type
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";

  formData.append("file", {
    uri: fileUri,
    type: mimeType,
    name: fileName,
  } as any);

  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_IMAGE_URL, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      errorData?.error?.message || `Upload foto gagal (status ${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    original_filename: data.original_filename,
    bytes: data.bytes,
  };
}
