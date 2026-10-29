// ============================================
// Image Compression Utilities
// ============================================
// Compress images in the browser before uploading to reduce bandwidth
// and improve performance. Converts to WebP format when supported.

import imageCompression from 'browser-image-compression';

function isWebPSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Check if a file is an image based on MIME type or extension
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(heic|heif|jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(file.name);
}

/**
 * Cheap, synchronous HEIC/HEIF detection (MIME or extension).
 * iPhones often deliver HEIC with an empty or octet-stream MIME type, so we
 * also check the extension. Used to gate the lazy-loaded decoder.
 */
export function isHeicFile(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Decode a HEIC/HEIF file to a JPEG File.
 *
 * Why: browsers other than Safari cannot decode HEIC in <canvas>/<img>, so the
 * canvas-based compression path (browser-image-compression) fails silently and
 * the raw HEIC ends up uploaded — which then won't render anywhere. We decode
 * with libheif (WASM) via heic-to, which works in every browser.
 *
 * The decoder (~1.5MB WASM) is dynamically imported so it only loads when a
 * user actually attaches a HEIC file.
 */
async function decodeHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import('heic-to');
  const jpegBlob = await heicTo({
    blob: file,
    type: 'image/jpeg',
    quality: 0.92,
  });
  const baseName = file.name.replace(/\.(heic|heif)$/i, '');
  return new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

/**
 * Compress a single image file.
 * Strategy: library first → canvas fallback → original file (last resort)
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  if (!isImageFile(file)) return file;

  // Normalize HEIC/HEIF files with missing or wrong MIME type
  let normalizedFile = file;
  if ((!file.type || file.type === 'application/octet-stream') && /\.(heic|heif)$/i.test(file.name)) {
    normalizedFile = new File([file], file.name, { type: 'image/heic' });
  }

  // HEIC/HEIF: decode to JPEG first (libheif/WASM). Without this, non-Safari
  // browsers can't render HEIC in canvas, so the strategies below all fail and
  // the raw HEIC gets uploaded — producing a broken image in the post/feed.
  if (isHeicFile(normalizedFile)) {
    try {
      options.onProgress?.(0);
      normalizedFile = await decodeHeicToJpeg(normalizedFile);
    } catch (heicError) {
      // If decoding fails, fall through with the original file. The strategies
      // below will try (and likely return the original), but at least we don't
      // hard-fail the whole upload.
      console.error('❌ HEIC decode failed:', heicError);
    }
  }

  const supportsWebP = isWebPSupported();
  const isMobile = isMobileDevice();
  const targetType = supportsWebP ? 'image/webp' : 'image/jpeg';

  const finalOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 2000,
    useWebWorker: !isMobile,
    fileType: targetType,
    initialQuality: 0.8,
    ...options,
    // Override WebP if not supported
    ...(options.fileType === 'image/webp' && !supportsWebP ? { fileType: 'image/jpeg' } : {}),
  };

  // Pass onProgress to the library
  const libOptions: Parameters<typeof imageCompression>[1] = {
    maxSizeMB: finalOptions.maxSizeMB!,
    maxWidthOrHeight: finalOptions.maxWidthOrHeight!,
    useWebWorker: finalOptions.useWebWorker!,
    fileType: finalOptions.fileType!,
    initialQuality: finalOptions.initialQuality!,
    onProgress: finalOptions.onProgress,
  };

  const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);

  // Strategy 1: browser-image-compression library
  try {
    const compressed = await imageCompression(normalizedFile, libOptions);
    console.log(`✅ Compressed: ${originalSizeMB}MB → ${(compressed.size / 1024 / 1024).toFixed(2)}MB (${compressed.type})`);
    return compressed;
  } catch (libError) {
    console.warn('⚠️ Library compression failed, trying canvas fallback:', libError);
  }

  // Strategy 2: Manual canvas conversion (works for any format the browser can render)
  try {
    const converted = await convertImageViaCanvas(
      normalizedFile,
      finalOptions.maxWidthOrHeight ?? 2000,
      finalOptions.fileType ?? 'image/jpeg',
    );
    console.log(`✅ Canvas fallback: ${originalSizeMB}MB → ${(converted.size / 1024 / 1024).toFixed(2)}MB (${converted.type})`);
    return converted;
  } catch (canvasError) {
    console.error('❌ Canvas fallback also failed:', canvasError);
  }

  // Strategy 3: Return original (bucket now accepts up to 50MB)
  console.warn('⚠️ All compression failed, uploading original file');
  return file;
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  return Promise.all(files.map(file => compressImage(file, options)));
}

/**
 * Generate a blur placeholder data URL for an image
 */
export async function generateBlurDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context not available')); return; }
        const thumbSize = 10;
        canvas.width = thumbSize;
        canvas.height = thumbSize;
        ctx.drawImage(img, 0, 0, thumbSize, thumbSize);
        resolve(canvas.toDataURL('image/webp', 0.1));
      };
      img.onerror = () => reject(new Error('Failed to load image for blur generation'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions without loading the full image
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert any browser-renderable image to JPEG/WebP via canvas.
 * Fallback for when browser-image-compression fails (large JPGs, HEIC, etc.)
 */
async function convertImageViaCanvas(
  file: File,
  maxDim: number,
  outputType: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context not available')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Try requested format, fall back to JPEG
      const quality = 0.85;
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${baseName}.${ext}`, { type: outputType }));
        },
        outputType,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Browser cannot render this image format'));
    };
    // Use object URL instead of data URL - much more memory efficient for large files
    img.src = url;
  });
}
