// app/lib/performance-utils.ts
import { TurbineImage, Measurement } from "@/types";

/**
 * Debounce function for performance optimization
 */
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

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Memoization utility for expensive calculations
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Image preloader for better performance
 */
export class ImagePreloader {
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  async preloadImage(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        this.loadingPromises.delete(src);
        resolve(img);
      };
      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  async preloadImages(images: TurbineImage[]): Promise<void> {
    const promises = images.map((image) =>
      this.preloadImage(image.orig_img_src).catch(console.error)
    );
    await Promise.all(promises);
  }

  preloadAdjacentImages(
    images: TurbineImage[],
    currentIndex: number,
    range: number = 2
  ): void {
    const start = Math.max(0, currentIndex - range);
    const end = Math.min(images.length, currentIndex + range + 1);

    for (let i = start; i < end; i++) {
      if (i !== currentIndex) {
        this.preloadImage(images[i].orig_img_src).catch(console.error);
      }
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}

/**
 * Viewport utilities for better performance
 */
export class ViewportUtils {
  static isElementInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  static getVisibleArea(
    containerRect: DOMRect,
    elementRect: DOMRect
  ): { width: number; height: number; visible: boolean } {
    const left = Math.max(containerRect.left, elementRect.left);
    const right = Math.min(containerRect.right, elementRect.right);
    const top = Math.max(containerRect.top, elementRect.top);
    const bottom = Math.min(containerRect.bottom, elementRect.bottom);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    return {
      width,
      height,
      visible: width > 0 && height > 0,
    };
  }
}

/**
 * Measurement utilities
 */
export class MeasurementUtils {
  static formatDistance(distanceM: number): string {
    if (distanceM < 0.001) return `${(distanceM * 1000000).toFixed(0)}μm`;
    if (distanceM < 0.01) return `${(distanceM * 1000).toFixed(1)}mm`;
    if (distanceM < 1) return `${(distanceM * 100).toFixed(1)}cm`;
    if (distanceM < 1000) return `${distanceM.toFixed(2)}m`;
    return `${(distanceM / 1000).toFixed(2)}km`;
  }

  static calculateArea(measurements: { distance: number }[]): number {
    if (measurements.length < 3) return 0;

    // Simple polygon area calculation (assuming measurements form a closed shape)
    // This is a simplified version - you might want to implement a more sophisticated algorithm
    const perimeter = measurements.reduce((sum, m) => sum + m.distance, 0);
    return Math.pow(perimeter / 4, 2); // Approximate area for regular polygon
  }

  static exportMeasurements(
    measurements: Measurement[],
    imageInfo: TurbineImage,
    format: "csv" | "json" = "csv"
  ): string {
    if (format === "json") {
      return JSON.stringify(
        {
          image: {
            name: imageInfo.name,
            blade: imageInfo.blade,
            side: imageInfo.side,
            altitude: imageInfo.gsd?.flight_height,
            gsd: imageInfo.gsd?.gsd_cm_per_pixel,
          },
          measurements,
          exportDate: new Date().toISOString(),
        },
        null,
        2
      );
    }

    // CSV format
    const headers = [
      "ID",
      "Distance (m)",
      "Distance (cm)",
      "Pixel Distance",
      "Start X",
      "Start Y",
      "End X",
      "End Y",
      "Absolute Altitude (m)",
      "Blade Percentage",
      "Created At",
    ];

    const rows = measurements.map((m) => [
      m.id,
      ((m.distance || 0) / 100).toFixed(4),
      (m.distance || 0).toFixed(2),
      Math.sqrt(
        Math.pow(m.end.x - m.start.x, 2) + Math.pow(m.end.y - m.start.y, 2)
      ).toFixed(2),
      m.start.x.toFixed(2),
      m.start.y.toFixed(2),
      m.end.x.toFixed(2),
      m.end.y.toFixed(2),
      m.absolutePosition?.altitude?.toFixed(2) || "",
      m.absolutePosition?.bladePercentage?.toFixed(1) || "",
      m.createdAt ? new Date(m.createdAt).toISOString() : "",
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }
}

/**
 * Keyboard shortcut manager
 */
export class KeyboardShortcutManager {
  private shortcuts = new Map<string, () => void>();
  private activeElement: HTMLElement | null = null;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  register(key: string, callback: () => void): void {
    this.shortcuts.set(key.toLowerCase(), callback);
  }

  unregister(key: string): void {
    this.shortcuts.delete(key.toLowerCase());
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Don't trigger shortcuts when typing in input fields
    if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;

    const key = e.key.toLowerCase();
    const callback = this.shortcuts.get(key);

    if (callback) {
      e.preventDefault();
      callback();
    }
  }

  activate(element: HTMLElement): void {
    this.deactivate();
    this.activeElement = element;
    element.addEventListener("keydown", this.handleKeyDown);
  }

  deactivate(): void {
    if (this.activeElement) {
      this.activeElement.removeEventListener("keydown", this.handleKeyDown);
      this.activeElement = null;
    }
  }

  clear(): void {
    this.shortcuts.clear();
    this.deactivate();
  }
}

/**
 * Local storage utilities for persistence
 */
export class StorageUtils {
  static saveSettings(key: string, settings: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (error) {
      console.warn("Failed to save settings:", error);
    }
  }

  static loadSettings<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.warn("Failed to load settings:", error);
      return defaultValue;
    }
  }

  static saveMeasurements(imageId: string, measurements: Measurement[]): void {
    this.saveSettings(`measurements_${imageId}`, measurements);
  }

  static loadMeasurements(imageId: string): Measurement[] {
    return this.loadSettings(`measurements_${imageId}`, []);
  }

  static clearMeasurements(imageId: string): void {
    try {
      localStorage.removeItem(`measurements_${imageId}`);
    } catch (error) {
      console.warn("Failed to clear measurements:", error);
    }
  }

  static exportMeasurements(
    measurements: Measurement[],
    imageInfo: TurbineImage,
    format: "csv" | "json" = "csv"
  ): string {
    return MeasurementUtils.exportMeasurements(measurements, imageInfo, format);
  }
}

/**
 * Animation utilities
 */
export class AnimationUtils {
  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  static animateValue(
    start: number,
    end: number,
    duration: number,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ): void {
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOutCubic(progress);

      const currentValue = start + (end - start) * easedProgress;
      onUpdate(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (onComplete) {
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  static cancelAnimation(animationId: number): void {
    cancelAnimationFrame(animationId);
  }
}

/**
 * Error boundary utilities
 */
export class ErrorUtils {
  static handleImageError(error: Error, imageInfo: TurbineImage): void {
    console.error("Image loading error:", {
      error: error.message,
      image: imageInfo.name,
      src: imageInfo.orig_img_src,
      blade: imageInfo.blade,
      side: imageInfo.side,
    });
  }

  static handleMeasurementError(error: Error, context: any): void {
    console.error("Measurement error:", {
      error: error.message,
      context,
    });
  }

  static handleApiError(error: Error, endpoint: string): void {
    console.error("API error:", {
      error: error.message,
      endpoint,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Performance monitor
 */
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static startTimer(label: string): void {
    performance.mark(`${label}-start`);
  }

  static endTimer(label: string): number {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    const measures = performance.getEntriesByName(label, "measure");
    const latestMeasure = measures[measures.length - 1];
    const duration = latestMeasure.duration;

    // Store metric
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    const metrics = this.metrics.get(label)!;
    metrics.push(duration);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    return duration;
  }

  static getAverageTime(label: string): number {
    const metrics = this.metrics.get(label);
    if (!metrics || metrics.length === 0) return 0;

    return metrics.reduce((sum, time) => sum + time, 0) / metrics.length;
  }

  static clearMetrics(): void {
    this.metrics.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// Export singleton instances
export const imagePreloader = new ImagePreloader();
export const keyboardManager = new KeyboardShortcutManager();
export const performanceMonitor = new PerformanceMonitor();
