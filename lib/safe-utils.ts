// app/lib/safe-utils.ts (New utility file for safety checks)
import { isNumber, isNil } from "lodash-es";

export const safeNumber = (value: any, fallback: number = 0): number => {
  if (isNil(value) || !isNumber(value) || isNaN(value)) {
    return fallback;
  }
  return value;
};

export const safeToFixed = (value: any, digits: number = 2): string => {
  const num = safeNumber(value);
  return num.toFixed(digits);
};

export const safeString = (value: any, fallback: string = ""): string => {
  if (isNil(value) || typeof value !== "string") {
    return fallback;
  }
  return value;
};

export const safeArray = <T>(value: any, fallback: T[] = []): T[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value;
};

export const safeDivision = (
  numerator: number,
  denominator: number,
  fallback: number = 0
): number => {
  const safeNum = safeNumber(numerator);
  const safeDen = safeNumber(denominator);

  if (safeDen === 0) {
    return fallback;
  }

  const result = safeNum / safeDen;
  return isNaN(result) ? fallback : result;
};

// Measurement validation
export const isValidMeasurement = (measurement: any): boolean => {
  return (
    measurement &&
    measurement.start &&
    measurement.end &&
    safeNumber(measurement.start.x) >= 0 &&
    safeNumber(measurement.start.y) >= 0 &&
    safeNumber(measurement.end.x) >= 0 &&
    safeNumber(measurement.end.y) >= 0 &&
    safeNumber(measurement.distance) > 0
  );
};

// GSD validation
export const isValidGSD = (gsd: any): boolean => {
  return (
    gsd &&
    safeNumber(gsd.gsd_cm_per_pixel) > 0 &&
    safeNumber(gsd.distance_to_blade) > 0 &&
    gsd.distance_confidence &&
    ["high", "medium", "low"].includes(gsd.distance_confidence)
  );
};

// Image validation
export const isValidTurbineImage = (image: any): boolean => {
  return (
    image &&
    safeString(image.id) &&
    safeString(image.blade) &&
    ["A", "B", "C"].includes(image.blade) &&
    safeString(image.side) &&
    ["TE", "PS", "LE", "SS"].includes(image.side) &&
    safeString(image.orig_img_src) &&
    safeNumber(image.width) > 0 &&
    safeNumber(image.height) > 0 &&
    isValidGSD(image.gsd)
  );
};
