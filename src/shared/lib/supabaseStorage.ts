import { supabase } from '@/shared/lib/supabase';
import { compressImage, isImageFile } from '@/shared/utils/imageCompression';

// Storage bucket names
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  LESSON_FILES: 'lesson-files',
  POST_ATTACHMENTS: 'post-attachments',
} as const

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024, // 5MB
  LESSON_FILE: 10 * 1024 * 1024, // 10MB
  POST_ATTACHMENT: 40 * 1024 * 1024, // 40MB (ebooks/PDFs grandes; el bucket cap es 50MB)
} as const

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  AVATAR: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  LESSON_FILE: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'video/mp4',
    'application/zip',
  ],
  POST_ATTACHMENT: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    // Documents
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    // Ebooks
    'application/epub+zip', // .epub
    // Code & Text
    'application/json',
    'text/plain',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-python',
    'application/x-python',
    'text/x-python-script',
    'text/css',
    'text/html',
    'text/markdown',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-rar',
  ],
} as const

/**
 * Upload avatar for a user
 * @param userId - The user's ID
 * @param file - The file to upload
 * @returns The public URL of the uploaded avatar
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<string> {

  // Validate file size BEFORE compression
  if (file.size > FILE_SIZE_LIMITS.AVATAR) {
    throw new Error('Avatar file size exceeds 5MB limit')
  }

  // Validate MIME type
  if (!(ALLOWED_MIME_TYPES.AVATAR as readonly string[]).includes(file.type)) {
    throw new Error('Invalid file type for avatar')
  }

  // ✅ Compress image before uploading
  // Note: compressImage will automatically fallback to JPEG if WebP is not supported
  const compressedFile = await compressImage(file, {
    maxSizeMB: 0.5, // 500KB max for avatars
    maxWidthOrHeight: 512, // Avatars don't need to be huge
    fileType: 'image/webp', // Will fallback to JPEG if WebP not supported
  });

  // Use the actual file type extension (might be webp or jpeg depending on browser support)
  const extension = compressedFile.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(fileName, compressedFile, {
      cacheControl: '31536000', // 1 year cache
      upsert: true,
    })

  if (uploadError) {
    throw uploadError
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(fileName)

  // Add cache buster to force browser to fetch new image
  const cacheBuster = Date.now()
  return `${publicUrl}?v=${cacheBuster}`
}

/**
 * Delete avatar for a user
 * @param userId - The user's ID
 */
export async function deleteAvatar(userId: string): Promise<void> {

  const { data: files } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .list(userId)

  if (files && files.length > 0) {
    const filePaths = files.map((file) => `${userId}/${file.name}`)
    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .remove(filePaths)

    if (error) {
      throw error
    }
  }
}

/**
 * Upload lesson file (admin only)
 * @param lessonId - The lesson's ID
 * @param file - The file to upload
 * @returns The path to the uploaded file
 */
export async function uploadLessonFile(
  lessonId: string,
  file: File
): Promise<string> {

  // Validate file size
  if (file.size > FILE_SIZE_LIMITS.LESSON_FILE) {
    throw new Error('Lesson file size exceeds 10MB limit')
  }

  // Validate MIME type
  if (!(ALLOWED_MIME_TYPES.LESSON_FILE as readonly string[]).includes(file.type)) {
    throw new Error('Invalid file type for lesson file')
  }

  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const fileName = `${lessonId}/${timestamp}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.LESSON_FILES)
    .upload(fileName, file, {
      cacheControl: '3600',
    })

  if (uploadError) {
    throw uploadError
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKETS.LESSON_FILES).getPublicUrl(fileName)

  return publicUrl
}

/**
 * Delete lesson file (admin only)
 * @param filePath - The path to the file (from file_urls array)
 */
export async function deleteLessonFile(filePath: string): Promise<void> {

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.LESSON_FILES)
    .remove([filePath])

  if (error) {
    throw error
  }
}

/**
 * Upload attachment for a post
 * @param userId - The user's ID
 * @param file - The file to upload
 * @returns Object with public URL and metadata
 */
export async function uploadPostAttachment(
  userId: string,
  file: File,
  onStatus?: (status: string) => void,
): Promise<{
  url: string;
  name: string;
  size: number;
  type: string;
}> {

  const allowedExtensions = [
    '.pdf', '.epub', '.doc', '.docx', '.txt', '.json', '.py', '.js', '.ts', '.tsx', '.jsx',
    '.zip', '.rar', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.css', '.html', '.md',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'
  ];

  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  const isImage = isImageFile(file);
  const isMimeTypeAllowed = (ALLOWED_MIME_TYPES.POST_ATTACHMENT as readonly string[]).includes(file.type);
  const isExtensionAllowed = allowedExtensions.includes(fileExtension);

  if (!isMimeTypeAllowed && !isExtensionAllowed) {
    throw new Error(`Tipo de archivo no permitido: ${file.name}`)
  }

  // Non-images: strict 10MB. Images: 50MB pre-compression (cameras produce huge files)
  if (!isImage && file.size > FILE_SIZE_LIMITS.POST_ATTACHMENT) {
    throw new Error(`El archivo excede el límite de ${Math.round(FILE_SIZE_LIMITS.POST_ATTACHMENT / 1024 / 1024)}MB`)
  }
  const IMAGE_PRE_COMPRESSION_LIMIT = 50 * 1024 * 1024;
  if (isImage && file.size > IMAGE_PRE_COMPRESSION_LIMIT) {
    throw new Error('La imagen excede el límite de 50MB')
  }

  // Compress images (JPG, PNG, WebP, HEIC → WebP ~1MB)
  let fileToUpload = file;
  if (isImage) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    onStatus?.(`Comprimiendo ${sizeMB}MB...`);
    fileToUpload = await compressImage(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      fileType: 'image/webp',
      onProgress: (p) => {
        if (p < 100) onStatus?.(`Comprimiendo ${Math.round(p)}%...`);
        else onStatus?.('Subiendo...');
      },
    });
    onStatus?.('Subiendo...');
  }

  const timestamp = Date.now()
  // After compression, the file format may have changed (e.g., JPG → WebP)
  // Update the extension to match the actual MIME type
  const mimeToExt: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
  }
  const actualExt = mimeToExt[fileToUpload.type] || fileToUpload.name.split('.').pop()
  const baseName = fileToUpload.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_')
  const sanitizedName = `${baseName}.${actualExt}`
  const fileName = `${userId}/${timestamp}-${sanitizedName}`

  // Some browsers report an empty MIME type for .epub; fall back by extension
  // so the file is served (and re-downloaded) with the correct content type.
  const contentType = fileToUpload.type || (actualExt === 'epub' ? 'application/epub+zip' : 'application/octet-stream')

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.POST_ATTACHMENTS)
    .upload(fileName, fileToUpload, {
      cacheControl: '31536000', // 1 year cache
      contentType, // Explicit MIME type to match actual file format
    })

  if (uploadError) {
    throw uploadError
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKETS.POST_ATTACHMENTS).getPublicUrl(fileName)

  return {
    url: publicUrl,
    name: file.name, // Original name
    size: fileToUpload.size, // Compressed size
    type: fileToUpload.type, // Might be webp now
  }
}

/**
 * Upload voice message (mensajes de voz del chat, 7 ago 2026)
 * Sin compresión: el blob ya sale chico del MediaRecorder (AAC/opus mono).
 * Límite 15MB ≈ holgado para el techo de 10 min del grabador.
 */
export async function uploadVoiceMessage(
  userId: string,
  blob: Blob,
  mime: string,
): Promise<{ url: string; name: string; size: number; type: string }> {
  const MAX_VOICE_BYTES = 15 * 1024 * 1024;
  if (blob.size > MAX_VOICE_BYTES) {
    throw new Error('El audio excede el límite de 15MB');
  }
  // El allowlist del bucket es EXACTO: "audio/webm;codecs=opus" no matchea
  // "audio/webm" — siempre el tipo base, sin parámetros
  const baseMime = (mime || 'audio/webm').split(';')[0].trim();
  const ext = baseMime.includes('mp4') ? 'm4a' : baseMime.includes('ogg') ? 'ogg' : 'webm';
  const fileName = `${userId}/${Date.now()}-voz.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.POST_ATTACHMENTS)
    .upload(fileName, blob, {
      cacheControl: '31536000', // 1 año: el audio es inmutable
      contentType: baseMime,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKETS.POST_ATTACHMENTS).getPublicUrl(fileName);

  return { url: publicUrl, name: `voz.${ext}`, size: blob.size, type: mime };
}

/**
 * Delete post attachment
 * @param fileUrl - The public URL of the file
 */
export async function deletePostAttachment(fileUrl: string): Promise<void> {
  // Extract file path from URL
  const bucketUrl = supabase.storage.from(STORAGE_BUCKETS.POST_ATTACHMENTS).getPublicUrl('').data.publicUrl
  const filePath = fileUrl.replace(bucketUrl, '')

  if (!filePath) {
    throw new Error('Invalid file URL')
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.POST_ATTACHMENTS)
    .remove([filePath])

  if (error) {
    throw error
  }
}

/**
 * Upload multiple attachments for a post
 * @param userId - The user's ID
 * @param files - Array of files to upload
 * @returns Array of uploaded file metadata
 */
export async function uploadMultiplePostAttachments(
  userId: string,
  files: File[]
): Promise<Array<{
  url: string;
  name: string;
  size: number;
  type: string;
}>> {
  const results = await Promise.all(
    files.map(file => uploadPostAttachment(userId, file))
  )
  return results
}
