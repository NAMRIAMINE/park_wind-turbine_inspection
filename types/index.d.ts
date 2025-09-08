// app/types/index.d.ts

export interface Point {
  x: number;
  y: number;
}

// Enhanced GSD interface
export interface GSDData {
  gsd_width: number; // meters per pixel
  gsd_height: number; // meters per pixel
  gsd_cm_per_pixel: number; // centimeters per pixel (for UI display)
  flight_height: number; // meters above ground (for sorting)
  distance_to_blade: number; // meters (used for GSD calculation)
  altitude_source: string; // how altitude was determined
  distance_source: string; // how distance to blade was determined
  distance_confidence: "high" | "medium" | "low";
}

// Enhanced camera specs
export interface CameraSpecs {
  make: string;
  model: string;
  focal_length: number; // millimeters (parsed as number)
  sensor_width: number; // millimeters
  sensor_height: number; // millimeters
}

// GPS data interface
export interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number; // GPS altitude (above sea level)
}

// Enhanced absolute positioning
export interface AbsolutePosition {
  altitude: number; // Absolute altitude in meters
  baseAltitude: number; // Base image altitude in meters
  relativeHeight: number; // Relative height from base in meters
  bladePercentage: number; // Percentage along blade length (0-100)
  gps?: GPSData;
}

// Enhanced measurement interface
export interface Measurement {
  id: string;
  start: Point;
  end: Point;
  distance: number; // Distance in centimeters
  gsd_used?: number; // GSD used for this measurement (cm/pixel)
  absolutePosition?: AbsolutePosition; // Enhanced positioning data
  createdAt?: Date;
  updatedAt?: Date;
  type?: "linear" | "area" | "point";
  label?: string;
  confidence?: number;
  accuracy?: number;
}

// Measurement group for organizing measurements
export interface MeasurementGroup {
  id: string;
  name: string;
  measurements: Measurement[];
  type: "inspection" | "damage" | "maintenance" | "analysis";
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  notes?: string;
  status?: "draft" | "completed" | "reviewed" | "approved";
}

// Enhanced filter state
export interface FilterState {
  blade: "A" | "B" | "C";
  side: "TE" | "PS" | "LE" | "SS";
}

// Enhanced view state
export interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
  showRuler: boolean;
  showUI: boolean;
  measureMode: boolean;
  fullscreen: boolean;
  rulerOpacity?: number;
  crosshairVisible?: boolean;
}

// Enhanced turbine settings
export interface TurbineSettings {
  autoPreload: boolean;
  preloadRange: number;
  animationDuration: number;
  debounceDelay: number;
  rulerOpacity: number;
  defaultZoom: number;
  keyboardShortcuts: boolean;
  persistMeasurements: boolean;
  showTooltips: boolean;
  theme: "light" | "dark" | "auto";
  measurementPrecision: number;
  autoSave: boolean;
  gridOverlay: boolean;
  showImageInfo: boolean;
}

// Enhanced blade context
export interface BladeContext {
  lengthMeters: number;
  lengthPixels: number;
  minAltitude: number;
  maxAltitude: number;
  altitudeRange: number;
  currentAltitude: number;
  totalImages: number;
  averageSpacing: number;
  pixelsPerMeter: number;
  currentImagePosition?: ImagePosition | null;
}

// Enhanced turbine image interface (compatible with existing)
export interface TurbineImage {
  id: string;
  name: string;
  orig_img_src: string;
  thumbnail_src: string;
  width: number;
  height: number;
  blade: "A" | "B" | "C";
  side: "TE" | "PS" | "LE" | "SS";
  camera: CameraSpecs;
  gsd: GSDData;
  date: string;
  gps?: GPSData;
  metadata?: ImageMetadata;
  processedAt?: Date;
  fileSize?: number;
  checksum?: string;
}

// Enhanced image metadata
export interface ImageMetadata {
  exif?: Record<string, any>;
  gps?: GPSData;
  datetime?: string;
  weather?: WeatherData;
  inspection_info?: InspectionInfo;
}

// Weather data interface
export interface WeatherData {
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  wind_direction?: number;
  conditions?: string;
}

// Inspection info interface
export interface InspectionInfo {
  inspector_name?: string;
  inspection_date?: string;
  inspection_type?: string;
  flight_mission?: string;
  notes?: string;
}

// Upload metadata interface (compatible with existing)
export interface UploadMetadata {
  blade: "A" | "B" | "C";
  side: "TE" | "PS" | "LE" | "SS";
  folderName: string;
  originalPath: string;
  manualDistance?: number; // manual distance to blade override
  referencePixels?: number; // for reference object calibration
  referenceRealSize?: number; // real size of reference object in meters
  referenceObjectName?: string; // description of reference object
}

// Enhanced turbine images summary
export interface TurbineImagesSummary {
  total: number;
  by_blade: { A: number; B: number; C: number };
  by_side: { TE: number; PS: number; LE: number; SS: number };
  measurement_ready: number;
  altitude_range: {
    min: number;
    max: number;
    span: number;
  } | null;
  gsd_range: {
    min: number;
    max: number;
    average: number;
  } | null;
}

// Validation interfaces
export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
  statistics: ValidationStatistics;
}

export interface ValidationStatistics {
  totalImages: number;
  validForMeasurement: number;
  highConfidenceDistance: number;
  mediumConfidenceDistance: number;
  lowConfidenceDistance: number;
  averageGSD: number;
  gsdRange: { min: number; max: number };
}

// Blade metrics interface
export interface BladeMetrics {
  lengthMeters: number;
  lengthPixels: number;
  minAltitude: number;
  maxAltitude: number;
  altitudeRange: number;
  totalImages: number;
  averageSpacing: number;
  pixelsPerMeter: number;
}

// Image position interface
export interface ImagePosition {
  altitudeFromBase: number;
  percentageFromBase: number;
  positionPixels: number;
  imageIndex: number;
  relativePosition: number; // 0 to 1
}

// Export options interface
export interface ExportOptions {
  format: "csv" | "json" | "pdf" | "excel";
  includeImages: boolean;
  includeMeasurements: boolean;
  includeMetadata: boolean;
  compression: "none" | "zip" | "gzip";
  resolution?: "original" | "high" | "medium" | "low";
}

// Statistics interface
export interface Statistics {
  totalImages: number;
  totalMeasurements: number;
  averageMeasurements: string;
  currentImageMeasurements: number;
  bladeLength: number;
  currentProgress: number;
}

// Performance interface
export interface Performance {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  imagesCached: number;
  measurementCount: number;
  lastUpdate: Date;
}

// API response interface
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: Date;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Legacy compatibility types (maintain existing API)
export type TurbineImagesResponse = TurbineImage[];
export type { FilterState as Filter };
export type { ViewState as View };
export type { TurbineSettings as Settings };
export type { BladeContext as Blade };
export type { Measurement as Measure };
export type { TurbineImage as Image };

// Distance info interface (for upload processing)
export interface DistanceInfo {
  distance: number;
  source: string;
  confidence: "high" | "medium" | "low";
  raw_value?: any;
}

// EXIF validation interface
export interface ExifValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

// Uploaded file interface
export interface UploadedFile {
  file: File;
  path: string;
  blade?: "A" | "B" | "C";
  side?: "TE" | "PS" | "LE" | "SS";
}

// Parsed folder interface
export interface ParsedFolder {
  name: string;
  blade: "A" | "B" | "C";
  side: "TE" | "PS" | "LE" | "SS";
  files: File[];
}

// Reference calibration interface
export interface ReferenceCalibration {
  pixels: number; // pixel distance of measured object
  realSize: number; // real-world size in meters
  objectName?: string; // description of measured object
  gsd_calculated: number; // GSD calculated from reference object
}
