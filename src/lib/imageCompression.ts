import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  fileType?: string;
}

const PRODUCT_DEFAULTS: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2000,
  quality: 0.85,
  fileType: "image/webp",
};

const LOGO_DEFAULTS: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  quality: 0.9,
};

export async function compressImage(
  file: File,
  type: "logo" | "product_image" | "other" = "other",
  onProgress?: (progress: number) => void
): Promise<File> {
  // Skip non-images
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const opts = type === "logo" ? LOGO_DEFAULTS : type === "product_image" ? PRODUCT_DEFAULTS : { maxSizeMB: 2, maxWidthOrHeight: 2000 };

  const compressed = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 2,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 2000,
    useWebWorker: true,
    fileType: opts.fileType as string | undefined,
    onProgress: (p) => onProgress?.(p),
  });

  return compressed as File;
}
