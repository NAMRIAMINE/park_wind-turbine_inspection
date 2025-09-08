import { Point } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function validateImageFile(file: File): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
  ];
  return validTypes.includes(file.type);
}

export function extractCoordinates(
  exifData: any
): { lat: number; lng: number } | null {
  if (exifData.latitude && exifData.longitude) {
    return {
      lat: exifData.latitude,
      lng: exifData.longitude,
    };
  }
  return null;
}

export function parseFolderName(
  folderName: string
): { blade: "A" | "B" | "C"; side: "TE" | "PS" | "LE" | "SS" } | null {
  // Pattern: DJI_YYYYMMDD_NN_PREFIX-X-BLADE-SIDE-SUFFIX
  const match = folderName.match(/DJI_\d+_\d+_[^-]+-[^-]+-([ABC])-([A-Z]{2})-/);

  if (match) {
    const blade = match[1] as "A" | "B" | "C";
    const side = match[2] as "TE" | "PS" | "LE" | "SS";

    // Validate side
    if (["TE", "PS", "LE", "SS"].includes(side)) {
      return { blade, side };
    }
  }

  return null;
}

export function calculatePixelDistance(point1: Point, point2: Point): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
  );
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters <= 0) return "0mm";

  const mm = distanceMeters * 1000;
  const cm = distanceMeters * 100;

  if (mm < 1) {
    return `${mm.toFixed(2)}mm`;
  } else if (mm < 10) {
    return `${mm.toFixed(1)}mm`;
  } else if (cm < 100) {
    return `${cm.toFixed(1)}cm`;
  } else {
    return `${distanceMeters.toFixed(2)}m`;
  }
}

export function calculateRealDistance(
  pixelDistance: number,
  gsd_cm_per_pixel: number
): number {
  return pixelDistance * gsd_cm_per_pixel; // Returns distance in centimeters
}

// GSD calculation helper
export function calculateGSD(
  focalLengthMm: number,
  distanceToSubjectM: number,
  sensorWidthMm: number,
  sensorHeightMm: number,
  imageWidthPx: number,
  imageHeightPx: number
): {
  gsd_width_m: number;
  gsd_height_m: number;
  gsd_cm_per_pixel: number;
} {
  // GSD formula: (sensor_size_mm * distance_m) / (focal_length_mm * image_size_px) / 1000
  const gsd_width_m =
    (sensorWidthMm * distanceToSubjectM) / (focalLengthMm * imageWidthPx);
  const gsd_height_m =
    (sensorHeightMm * distanceToSubjectM) / (focalLengthMm * imageHeightPx);
  const gsd_avg_m = (gsd_width_m + gsd_height_m) / 2;
  const gsd_cm_per_pixel = gsd_avg_m * 100; // Convert to cm/pixel for practical use

  return {
    gsd_width_m,
    gsd_height_m,
    gsd_cm_per_pixel,
  };
}

// Safe number utilities
export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return fallback;
  }
  return Number(value);
}

export function safeToFixed(value: any, digits: number = 2): string {
  const num = safeNumber(value);
  return num.toFixed(digits);
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
