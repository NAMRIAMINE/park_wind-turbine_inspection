// app/lib/blade-utils.ts
import { TurbineImage, BladeMetrics, ImagePosition } from "@/types";

/**
 * Calculate enhanced blade metrics from images
 */
export function calculateBladeMetrics(
  images: TurbineImage[],
  pixelsPerMeter: number = 3
): BladeMetrics {
  if (images.length === 0) {
    return {
      lengthMeters: 0,
      lengthPixels: 0,
      minAltitude: 0,
      maxAltitude: 0,
      altitudeRange: 0,
      totalImages: 0,
      averageSpacing: 0,
      pixelsPerMeter,
    };
  }

  // Get valid altitudes and sort
  const altitudes = images
    .map((img) => img.gsd?.flight_height || 0)
    .filter((alt) => alt > 0)
    .sort((a, b) => a - b);

  if (altitudes.length === 0) {
    return {
      lengthMeters: 0,
      lengthPixels: 0,
      minAltitude: 0,
      maxAltitude: 0,
      altitudeRange: 0,
      totalImages: images.length,
      averageSpacing: 0,
      pixelsPerMeter,
    };
  }

  const minAltitude = altitudes[0];
  const maxAltitude = altitudes[altitudes.length - 1];
  const altitudeRange = maxAltitude - minAltitude;
  const lengthMeters = altitudeRange;

  // Calculate pixel length with minimum size for display
  const lengthPixels = Math.max(
    200,
    Math.min(500, lengthMeters * pixelsPerMeter)
  );

  // Calculate average spacing between images
  const averageSpacing =
    altitudes.length > 1 ? altitudeRange / (altitudes.length - 1) : 0;

  return {
    lengthMeters,
    lengthPixels,
    minAltitude,
    maxAltitude,
    altitudeRange,
    totalImages: images.length,
    averageSpacing,
    pixelsPerMeter,
  };
}

/**
 * Calculate position of specific image on the blade
 */
export function calculateImagePosition(
  image: TurbineImage,
  bladeMetrics: BladeMetrics
): ImagePosition {
  const currentAltitude = image?.gsd?.flight_height || bladeMetrics.minAltitude;
  const altitudeFromBase = currentAltitude - bladeMetrics.minAltitude;

  const percentageFromBase =
    bladeMetrics.altitudeRange > 0
      ? (altitudeFromBase / bladeMetrics.altitudeRange) * 100
      : 0;

  const relativePosition =
    bladeMetrics.altitudeRange > 0
      ? altitudeFromBase / bladeMetrics.altitudeRange
      : 0;

  // Calculate pixel position from bottom (since altitude increases upward)
  // Position 0 = bottom of blade, position 1 = top of blade
  const positionPixels =
    bladeMetrics.lengthPixels - relativePosition * bladeMetrics.lengthPixels;

  return {
    altitudeFromBase,
    percentageFromBase,
    positionPixels: Math.max(
      4,
      Math.min(bladeMetrics.lengthPixels - 4, positionPixels)
    ),
    imageIndex: 0, // Will be set by caller
    relativePosition,
  };
}

/**
 * Get coverage statistics for blade inspection
 */
export function getBladeCoverage(images: TurbineImage[]): {
  totalCoverage: number;
  gaps: Array<{ start: number; end: number; size: number }>;
  densityMap: Array<{ altitude: number; imageCount: number }>;
  qualityScore: number;
} {
  if (images.length === 0) {
    return {
      totalCoverage: 0,
      gaps: [],
      densityMap: [],
      qualityScore: 0,
    };
  }

  const altitudes = images
    .map((img) => img.gsd?.flight_height || 0)
    .filter((alt) => alt > 0)
    .sort((a, b) => a - b);

  if (altitudes.length === 0) {
    return {
      totalCoverage: 0,
      gaps: [],
      densityMap: [],
      qualityScore: 0,
    };
  }

  const minAltitude = altitudes[0];
  const maxAltitude = altitudes[altitudes.length - 1];
  const totalRange = maxAltitude - minAltitude;

  // Calculate coverage percentage
  const totalCoverage = totalRange > 0 ? 100 : 0;

  // Find gaps (areas with sparse coverage)
  const gaps: Array<{ start: number; end: number; size: number }> = [];
  if (altitudes.length > 1) {
    const avgSpacing = totalRange / (altitudes.length - 1);
    const gapThreshold = avgSpacing * 2.5; // Gaps larger than 2.5x average spacing

    for (let i = 1; i < altitudes.length; i++) {
      const gap = altitudes[i] - altitudes[i - 1];
      if (gap > gapThreshold) {
        gaps.push({
          start: altitudes[i - 1],
          end: altitudes[i],
          size: gap,
        });
      }
    }
  }

  // Create density map (binned by altitude)
  const binCount = Math.min(20, Math.max(5, Math.floor(altitudes.length / 2)));
  const binSize = totalRange / binCount;
  const densityMap: Array<{ altitude: number; imageCount: number }> = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = minAltitude + i * binSize;
    const binEnd = binStart + binSize;
    const binCenter = binStart + binSize / 2;

    const imageCount = altitudes.filter(
      (alt) => alt >= binStart && alt < binEnd
    ).length;

    densityMap.push({
      altitude: binCenter,
      imageCount,
    });
  }

  // Calculate quality score (0-100)
  let qualityScore = 100;

  // Penalize for gaps
  const gapPenalty =
    totalRange > 0
      ? (gaps.reduce((sum, gap) => sum + gap.size, 0) / totalRange) * 50
      : 0;
  qualityScore -= gapPenalty;

  // Penalize for low image density
  const avgDensity = totalRange > 0 ? altitudes.length / totalRange : 0;
  if (avgDensity < 0.1) {
    // Less than 1 image per 10m
    qualityScore -= 30;
  }

  // Bonus for high image count
  if (altitudes.length >= 20) {
    qualityScore += 10;
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    totalCoverage,
    gaps,
    densityMap,
    qualityScore,
  };
}

/**
 * Calculate optimal ruler intervals based on GSD and zoom
 */
export function calculateRulerIntervals(
  gsdCmPerPixel: number,
  zoom: number,
  scaleFactor: number = 1
): {
  rulerIntervalCm: number;
  majorIntervalCm: number;
  minorIntervalCm: number;
  rulerIntervalPx: number;
  majorIntervalPx: number;
  minorIntervalPx: number;
  effectiveGsdCmPerPixel: number;
} {
  const effectiveGsdCmPerPixel = gsdCmPerPixel / (scaleFactor * zoom);

  let rulerIntervalCm: number;
  let majorIntervalCm: number;
  let minorIntervalCm: number;

  // Determine appropriate intervals based on effective scale
  if (effectiveGsdCmPerPixel > 100) {
    rulerIntervalCm = 500; // 5m
    majorIntervalCm = 1000; // 10m
    minorIntervalCm = 250; // 2.5m
  } else if (effectiveGsdCmPerPixel > 50) {
    rulerIntervalCm = 100; // 1m
    majorIntervalCm = 500; // 5m
    minorIntervalCm = 50; // 50cm
  } else if (effectiveGsdCmPerPixel > 20) {
    rulerIntervalCm = 50; // 50cm
    majorIntervalCm = 200; // 2m
    minorIntervalCm = 25; // 25cm
  } else if (effectiveGsdCmPerPixel > 10) {
    rulerIntervalCm = 20; // 20cm
    majorIntervalCm = 100; // 1m
    minorIntervalCm = 10; // 10cm
  } else if (effectiveGsdCmPerPixel > 5) {
    rulerIntervalCm = 10; // 10cm
    majorIntervalCm = 50; // 50cm
    minorIntervalCm = 5; // 5cm
  } else if (effectiveGsdCmPerPixel > 1) {
    rulerIntervalCm = 5; // 5cm
    majorIntervalCm = 20; // 20cm
    minorIntervalCm = 2; // 2cm
  } else {
    rulerIntervalCm = 1; // 1cm
    majorIntervalCm = 10; // 10cm
    minorIntervalCm = 0.5; // 5mm
  }

  const rulerIntervalPx = rulerIntervalCm / effectiveGsdCmPerPixel;
  const majorIntervalPx = majorIntervalCm / effectiveGsdCmPerPixel;
  const minorIntervalPx = minorIntervalCm / effectiveGsdCmPerPixel;

  return {
    rulerIntervalCm,
    majorIntervalCm,
    minorIntervalCm,
    rulerIntervalPx,
    majorIntervalPx,
    minorIntervalPx,
    effectiveGsdCmPerPixel,
  };
}

/**
 * Format distance for display with appropriate units
 */
export function formatDistanceForRuler(distanceCm: number): string {
  if (distanceCm >= 10000) {
    const km = distanceCm / 100000;
    return `${km.toFixed(km >= 10 ? 0 : 1)}km`;
  } else if (distanceCm >= 1000) {
    const meters = distanceCm / 100;
    return `${meters.toFixed(0)}m`;
  } else if (distanceCm >= 100) {
    const meters = distanceCm / 100;
    return `${meters.toFixed(1)}m`;
  } else if (distanceCm >= 10) {
    return `${Math.round(distanceCm)}cm`;
  } else if (distanceCm >= 1) {
    return `${distanceCm.toFixed(1)}cm`;
  } else {
    return `${(distanceCm * 10).toFixed(0)}mm`;
  }
}

/**
 * Get blade color scheme for UI consistency
 */
export function getBladeColorScheme(blade: "A" | "B" | "C"): {
  gradient: string;
  solid: string;
  light: string;
  text: string;
  border: string;
} {
  switch (blade) {
    case "A":
      return {
        gradient: "from-blue-500 to-blue-600",
        solid: "bg-blue-500",
        light: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-500",
      };
    case "B":
      return {
        gradient: "from-green-500 to-green-600",
        solid: "bg-green-500",
        light: "bg-green-100",
        text: "text-green-700",
        border: "border-green-500",
      };
    case "C":
      return {
        gradient: "from-orange-500 to-orange-600",
        solid: "bg-orange-500",
        light: "bg-orange-100",
        text: "text-orange-700",
        border: "border-orange-500",
      };
    default:
      return {
        gradient: "from-gray-500 to-gray-600",
        solid: "bg-gray-500",
        light: "bg-gray-100",
        text: "text-gray-700",
        border: "border-gray-500",
      };
  }
}

/**
 * Get side information and styling
 */
export function getSideInfo(side: "TE" | "PS" | "LE" | "SS"): {
  fullName: string;
  description: string;
  color: string;
  shortCode: string;
} {
  switch (side) {
    case "TE":
      return {
        fullName: "Trailing Edge",
        description: "Back edge of the blade where air flows meet",
        color: "bg-red-100 text-red-700 border-red-300",
        shortCode: "TE",
      };
    case "LE":
      return {
        fullName: "Leading Edge",
        description: "Front edge of the blade that cuts through air",
        color: "bg-blue-100 text-blue-700 border-blue-300",
        shortCode: "LE",
      };
    case "PS":
      return {
        fullName: "Pressure Side",
        description: "High pressure side of the blade",
        color: "bg-green-100 text-green-700 border-green-300",
        shortCode: "PS",
      };
    case "SS":
      return {
        fullName: "Suction Side",
        description: "Low pressure side of the blade",
        color: "bg-purple-100 text-purple-700 border-purple-300",
        shortCode: "SS",
      };
    default:
      return {
        fullName: side,
        description: "Unknown blade side",
        color: "bg-gray-100 text-gray-700 border-gray-300",
        shortCode: side,
      };
  }
}

/**
 * Calculate estimated GSD from distance and camera specs
 */
export function calculateEstimatedGSD(
  distanceToBladeM: number,
  focalLengthMm: number,
  sensorWidthMm: number,
  sensorHeightMm: number,
  imageWidthPx: number,
  imageHeightPx: number
): {
  gsdWidthCmPerPx: number;
  gsdHeightCmPerPx: number;
  gsdAvgCmPerPx: number;
} {
  const gsdWidthMPerPx =
    (sensorWidthMm * distanceToBladeM) / (focalLengthMm * imageWidthPx);
  const gsdHeightMPerPx =
    (sensorHeightMm * distanceToBladeM) / (focalLengthMm * imageHeightPx);

  const gsdWidthCmPerPx = gsdWidthMPerPx * 100;
  const gsdHeightCmPerPx = gsdHeightMPerPx * 100;
  const gsdAvgCmPerPx = (gsdWidthCmPerPx + gsdHeightCmPerPx) / 2;

  return {
    gsdWidthCmPerPx,
    gsdHeightCmPerPx,
    gsdAvgCmPerPx,
  };
}

/**
 * Validate blade data quality and provide recommendations
 */
export function validateBladeData(images: TurbineImage[]): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  qualityScore: number;
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (images.length === 0) {
    return {
      isValid: false,
      warnings: ["No images provided"],
      recommendations: ["Upload turbine blade images to begin analysis"],
      qualityScore: 0,
    };
  }

  const bladeMetrics = calculateBladeMetrics(images);
  const coverage = getBladeCoverage(images);

  let qualityScore = 100;

  // Check image count
  if (images.length < 5) {
    warnings.push("Very few images - may not provide adequate blade coverage");
    recommendations.push(
      "Capture more images along the blade length for better coverage"
    );
    qualityScore -= 20;
  } else if (images.length < 10) {
    warnings.push(
      "Limited images - consider capturing more for complete coverage"
    );
    recommendations.push("Add more images to improve blade analysis accuracy");
    qualityScore -= 10;
  }

  // Check blade length coverage
  if (bladeMetrics.lengthMeters < 5) {
    warnings.push(
      "Blade coverage seems very short - may not represent full blade"
    );
    recommendations.push(
      "Ensure drone captures the full blade length from root to tip"
    );
    qualityScore -= 15;
  } else if (bladeMetrics.lengthMeters < 20) {
    warnings.push("Blade coverage is relatively short");
    recommendations.push(
      "Consider extending coverage to capture more of the blade length"
    );
    qualityScore -= 5;
  }

  // Check for coverage gaps
  if (coverage.gaps.length > 0) {
    const totalGapSize = coverage.gaps.reduce((sum, gap) => sum + gap.size, 0);
    warnings.push(
      `${
        coverage.gaps.length
      } coverage gaps detected (total: ${totalGapSize.toFixed(1)}m)`
    );
    recommendations.push(
      "Capture additional images to fill coverage gaps for complete inspection"
    );
    qualityScore -= coverage.gaps.length * 8;
  }

  // Check GSD consistency
  const gsdValues = images
    .map((img) => img.gsd?.gsd_cm_per_pixel || 0)
    .filter((gsd) => gsd > 0);

  if (gsdValues.length > 0) {
    const avgGsd = gsdValues.reduce((a, b) => a + b, 0) / gsdValues.length;
    const stdDev = Math.sqrt(
      gsdValues.reduce((sum, gsd) => sum + Math.pow(gsd - avgGsd, 2), 0) /
        gsdValues.length
    );

    const variationPercent = (stdDev / avgGsd) * 100;

    if (variationPercent > 50) {
      warnings.push("Very high variation in image resolution (GSD)");
      recommendations.push(
        "Maintain consistent distance to blade during capture for uniform resolution"
      );
      qualityScore -= 20;
    } else if (variationPercent > 30) {
      warnings.push("High variation in image resolution (GSD)");
      recommendations.push(
        "Try to maintain more consistent distance to blade during capture"
      );
      qualityScore -= 10;
    }
  }

  // Check altitude spacing consistency
  if (bladeMetrics.averageSpacing > 0) {
    const altitudes = images
      .map((img) => img.gsd?.flight_height || 0)
      .filter((alt) => alt > 0)
      .sort((a, b) => a - b);

    if (altitudes.length > 2) {
      const spacings = [];
      for (let i = 1; i < altitudes.length; i++) {
        spacings.push(altitudes[i] - altitudes[i - 1]);
      }

      const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
      const maxSpacing = Math.max(...spacings);
      const minSpacing = Math.min(...spacings);

      if (maxSpacing > avgSpacing * 3) {
        warnings.push("Inconsistent spacing between images along blade");
        recommendations.push(
          "Maintain more consistent spacing between image capture points"
        );
        qualityScore -= 5;
      }
    }
  }

  // Bonus for good practices
  if (images.length >= 15 && coverage.gaps.length === 0) {
    qualityScore += 5; // Bonus for good coverage
  }

  if (gsdValues.length > 0) {
    const avgGsd = gsdValues.reduce((a, b) => a + b, 0) / gsdValues.length;
    if (avgGsd >= 0.05 && avgGsd <= 0.5) {
      // Good GSD range for blade inspection
      qualityScore += 5; // Bonus for appropriate resolution
    }
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    isValid: warnings.length === 0,
    warnings,
    recommendations,
    qualityScore,
  };
}

/**
 * Find closest image to a target altitude
 */
export function findClosestImageToAltitude(
  images: TurbineImage[],
  targetAltitude: number
): { image: TurbineImage; index: number; distance: number } | null {
  if (images.length === 0) return null;

  let closestImage = images[0];
  let closestIndex = 0;
  let closestDistance = Math.abs(
    (images[0].gsd?.flight_height || 0) - targetAltitude
  );

  images.forEach((img, index) => {
    const altitude = img.gsd?.flight_height || 0;
    const distance = Math.abs(altitude - targetAltitude);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestImage = img;
      closestIndex = index;
    }
  });

  return {
    image: closestImage,
    index: closestIndex,
    distance: closestDistance,
  };
}

/**
 * Get blade inspection statistics
 */
export function getBladeInspectionStats(images: TurbineImage[]): {
  coverage: ReturnType<typeof getBladeCoverage>;
  metrics: BladeMetrics;
  validation: ReturnType<typeof validateBladeData>;
  gsdStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
    count: number;
  };
  altitudeStats: {
    min: number;
    max: number;
    range: number;
    count: number;
  };
} {
  const coverage = getBladeCoverage(images);
  const metrics = calculateBladeMetrics(images);
  const validation = validateBladeData(images);

  // GSD statistics
  const gsdValues = images
    .map((img) => img.gsd?.gsd_cm_per_pixel || 0)
    .filter((gsd) => gsd > 0)
    .sort((a, b) => a - b);

  const gsdStats = {
    min: gsdValues.length > 0 ? gsdValues[0] : 0,
    max: gsdValues.length > 0 ? gsdValues[gsdValues.length - 1] : 0,
    avg:
      gsdValues.length > 0
        ? gsdValues.reduce((a, b) => a + b, 0) / gsdValues.length
        : 0,
    median:
      gsdValues.length > 0 ? gsdValues[Math.floor(gsdValues.length / 2)] : 0,
    count: gsdValues.length,
  };

  // Altitude statistics
  const altitudes = images
    .map((img) => img.gsd?.flight_height || 0)
    .filter((alt) => alt > 0)
    .sort((a, b) => a - b);

  const altitudeStats = {
    min: altitudes.length > 0 ? altitudes[0] : 0,
    max: altitudes.length > 0 ? altitudes[altitudes.length - 1] : 0,
    range:
      altitudes.length > 0 ? altitudes[altitudes.length - 1] - altitudes[0] : 0,
    count: altitudes.length,
  };

  return {
    coverage,
    metrics,
    validation,
    gsdStats,
    altitudeStats,
  };
}
