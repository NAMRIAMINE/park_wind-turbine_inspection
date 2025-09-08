// lib/image-validation.ts
import { TurbineImage } from "@/types";

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
  statistics: {
    totalImages: number;
    validForMeasurement: number;
    highConfidenceDistance: number;
    mediumConfidenceDistance: number;
    lowConfidenceDistance: number;
    averageGSD: number;
    gsdRange: { min: number; max: number };
  };
}

/**
 * Validate turbine images for measurement readiness
 */
export function validateTurbineImages(
  images: TurbineImage[]
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (images.length === 0) {
    errors.push("No images found");
    return {
      isValid: false,
      warnings,
      errors,
      suggestions: ["Upload some turbine blade images to get started"],
      statistics: {
        totalImages: 0,
        validForMeasurement: 0,
        highConfidenceDistance: 0,
        mediumConfidenceDistance: 0,
        lowConfidenceDistance: 0,
        averageGSD: 0,
        gsdRange: { min: 0, max: 0 },
      },
    };
  }

  let validForMeasurement = 0;
  let highConfidenceDistance = 0;
  let mediumConfidenceDistance = 0;
  let lowConfidenceDistance = 0;
  const gsdValues: number[] = [];

  // Analyze each image
  images.forEach((image, index) => {
    const imageLabel = `${image.blade}-${image.side} (${image.name})`;

    // Check if image has valid GSD
    if (
      !image.gsd ||
      !image.gsd.gsd_cm_per_pixel ||
      image.gsd.gsd_cm_per_pixel <= 0
    ) {
      errors.push(`Image ${imageLabel}: No valid GSD data`);
      return;
    }

    // Check GSD reasonableness
    const gsd = image.gsd.gsd_cm_per_pixel;
    if (gsd < 0.001 || gsd > 50) {
      warnings.push(
        `Image ${imageLabel}: Unusual GSD value (${gsd.toFixed(4)} cm/pixel)`
      );
    } else {
      validForMeasurement++;
      gsdValues.push(gsd);
    }

    // Check distance confidence
    switch (image.gsd.distance_confidence) {
      case "high":
        highConfidenceDistance++;
        break;
      case "medium":
        mediumConfidenceDistance++;
        break;
      case "low":
        lowConfidenceDistance++;
        warnings.push(
          `Image ${imageLabel}: Low confidence distance measurement`
        );
        break;
    }

    // Check distance source
    if (
      image.gsd.distance_source === "XMP:FocusDistance" ||
      image.gsd.distance_source === "FocusDistance" ||
      image.gsd.distance_source.toLowerCase().includes("focus")
    ) {
      errors.push(
        `Image ${imageLabel}: Using focus distance instead of blade distance (Source: ${image.gsd.distance_source})`
      );
    }

    // Check distance reasonableness for blade measurement
    const distance = image.gsd.distance_to_blade;
    if (distance < 0.5 || distance > 100) {
      warnings.push(
        `Image ${imageLabel}: Distance to blade (${distance}m) seems unusual for turbine blade inspection`
      );
    }

    // Check if distance source indicates proper blade distance
    if (
      !image.gsd.distance_source.toLowerCase().includes("comment") &&
      !image.gsd.distance_source.toLowerCase().includes("subject") &&
      image.gsd.distance_confidence !== "high"
    ) {
      suggestions.push(
        `Image ${imageLabel}: Consider adding explicit distance information to image metadata`
      );
    }
  });

  // Calculate statistics
  const statistics = {
    totalImages: images.length,
    validForMeasurement,
    highConfidenceDistance,
    mediumConfidenceDistance,
    lowConfidenceDistance,
    averageGSD:
      gsdValues.length > 0
        ? gsdValues.reduce((a, b) => a + b, 0) / gsdValues.length
        : 0,
    gsdRange:
      gsdValues.length > 0
        ? {
            min: Math.min(...gsdValues),
            max: Math.max(...gsdValues),
          }
        : { min: 0, max: 0 },
  };

  // Generate suggestions based on analysis
  if (lowConfidenceDistance > 0) {
    suggestions.push(
      "Consider re-uploading images with explicit distance-to-blade information in EXIF metadata"
    );
  }

  if (validForMeasurement < images.length * 0.8) {
    suggestions.push(
      "Less than 80% of images are suitable for measurement. Check EXIF metadata quality"
    );
  }

  if (statistics.gsdRange.max / statistics.gsdRange.min > 10) {
    warnings.push(
      "Large variation in GSD values detected. This may indicate inconsistent distance measurements"
    );
  }

  // Check if any images are using focus distance (should be fixed with new code)
  const focusDistanceImages = images.filter((img) =>
    img.gsd?.distance_source?.toLowerCase().includes("focus")
  );

  if (focusDistanceImages.length > 0) {
    errors.push(
      `${focusDistanceImages.length} images are using focus distance instead of blade distance. These need to be re-processed.`
    );
    suggestions.push(
      "Re-upload images with proper blade distance metadata, or add manual distance during upload"
    );
  }

  const isValid = errors.length === 0 && validForMeasurement > 0;

  return {
    isValid,
    warnings,
    errors,
    suggestions,
    statistics,
  };
}

/**
 * Validate individual image for measurement
 */
export function validateSingleImage(image: TurbineImage): {
  canMeasure: boolean;
  issues: string[];
  gsdQuality: "excellent" | "good" | "poor" | "unusable";
} {
  const issues: string[] = [];

  if (
    !image.gsd ||
    !image.gsd.gsd_cm_per_pixel ||
    image.gsd.gsd_cm_per_pixel <= 0
  ) {
    return {
      canMeasure: false,
      issues: ["No valid GSD data found"],
      gsdQuality: "unusable",
    };
  }

  const gsd = image.gsd.gsd_cm_per_pixel;
  const distance = image.gsd.distance_to_blade;
  const source = image.gsd.distance_source;
  const confidence = image.gsd.distance_confidence;

  // Check distance source
  if (source?.toLowerCase().includes("focus")) {
    issues.push(
      "Using focus distance instead of blade distance - measurements may be inaccurate"
    );
  }

  // Check distance reasonableness
  if (distance < 0.5) {
    issues.push("Distance to blade seems too close (< 0.5m)");
  } else if (distance > 100) {
    issues.push("Distance to blade seems too far (> 100m)");
  }

  // Check GSD reasonableness
  let gsdQuality: "excellent" | "good" | "poor" | "unusable" = "good";

  if (gsd < 0.001 || gsd > 50) {
    gsdQuality = "unusable";
    issues.push(`Unrealistic GSD value: ${gsd.toFixed(4)} cm/pixel`);
  } else if (gsd > 10) {
    gsdQuality = "poor";
    issues.push("Very low resolution for detailed measurements");
  } else if (gsd < 0.01) {
    gsdQuality = "excellent";
  } else if (gsd < 0.1) {
    gsdQuality = "good";
  } else {
    gsdQuality = "poor";
  }

  // Check confidence
  if (confidence === "low") {
    issues.push("Low confidence in distance measurement");
  }

  const canMeasure =
    issues.length === 0 ||
    (gsdQuality !== "unusable" && !source?.toLowerCase().includes("focus"));

  return {
    canMeasure,
    issues,
    gsdQuality,
  };
}

/**
 * Generate quality report for all images
 */
export function generateQualityReport(images: TurbineImage[]): string {
  const validation = validateTurbineImages(images);

  let report = "TURBINE IMAGE QUALITY REPORT\n";
  report += "================================\n\n";

  report += `Total Images: ${validation.statistics.totalImages}\n`;
  report += `Valid for Measurement: ${validation.statistics.validForMeasurement}\n`;
  report += `Average GSD: ${validation.statistics.averageGSD.toFixed(
    4
  )} cm/pixel\n`;
  report += `GSD Range: ${validation.statistics.gsdRange.min.toFixed(
    4
  )} - ${validation.statistics.gsdRange.max.toFixed(4)} cm/pixel\n\n`;

  report += "DISTANCE CONFIDENCE BREAKDOWN:\n";
  report += `High Confidence: ${validation.statistics.highConfidenceDistance}\n`;
  report += `Medium Confidence: ${validation.statistics.mediumConfidenceDistance}\n`;
  report += `Low Confidence: ${validation.statistics.lowConfidenceDistance}\n\n`;

  if (validation.errors.length > 0) {
    report += "ERRORS:\n";
    validation.errors.forEach((error) => {
      report += `❌ ${error}\n`;
    });
    report += "\n";
  }

  if (validation.warnings.length > 0) {
    report += "WARNINGS:\n";
    validation.warnings.forEach((warning) => {
      report += `⚠️ ${warning}\n`;
    });
    report += "\n";
  }

  if (validation.suggestions.length > 0) {
    report += "SUGGESTIONS:\n";
    validation.suggestions.forEach((suggestion) => {
      report += `💡 ${suggestion}\n`;
    });
    report += "\n";
  }

  report += `Overall Status: ${
    validation.isValid ? "✅ READY FOR MEASUREMENT" : "❌ NEEDS ATTENTION"
  }\n`;

  return report;
}

/**
 * Filter images that are ready for measurement
 */
export function getMeasurementReadyImages(
  images: TurbineImage[]
): TurbineImage[] {
  return images.filter((image) => {
    const validation = validateSingleImage(image);
    return validation.canMeasure && validation.gsdQuality !== "unusable";
  });
}

/**
 * Get images that need re-processing (using focus distance)
 */
export function getImagesNeedingReprocessing(
  images: TurbineImage[]
): TurbineImage[] {
  return images.filter((image) =>
    image.gsd?.distance_source?.toLowerCase().includes("focus")
  );
}
