// lib/exiftool-utils.ts
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { temporaryFile } from "tempy";
import { platform } from "os";

const execAsync = promisify(exec);

/**
 * Get the correct ExifTool command based on the operating system
 */
function getExifToolCommand(): string {
  const isWindows = platform() === "win32";
  return isWindows ? "exiftool.exe" : "exiftool";
}

/**
 * Check if ExifTool is installed and accessible
 */
export async function checkExifToolInstallation(): Promise<boolean> {
  try {
    const command = getExifToolCommand();
    await execAsync(`${command} -ver`);
    return true;
  } catch (error) {
    console.error("ExifTool not found:", error);
    return false;
  }
}

/**
 * Extract comprehensive EXIF data using direct ExifTool execution
 */
export async function extractExifWithDirectExifTool(
  buffer: Buffer
): Promise<any> {
  const tempFile = await temporaryFile({ extension: "jpg" });

  try {
    // Write buffer to temporary file
    await writeFile(tempFile, buffer);

    const command = getExifToolCommand();

    // Execute ExifTool with comprehensive options
    const exifToolCommand = `${command} -json -All -groupNames -duplicates -struct -coordFormat "%.8f" "${tempFile}"`;

    const { stdout, stderr } = await execAsync(exifToolCommand, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large metadata
    });

    if (stderr && !stderr.includes("Warning") && !stderr.includes("minor")) {
      console.warn("ExifTool stderr:", stderr);
    }

    // Parse JSON output
    const exifData = JSON.parse(stdout);

    // ExifTool returns an array, get the first (and only) element
    return exifData[0] || {};
  } catch (error) {
    console.error("Direct ExifTool execution failed:", error);
    throw new Error(`ExifTool execution failed: ${error}`);
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempFile);
    } catch (cleanupError) {
      console.warn("Failed to cleanup temp file:", cleanupError);
    }
  }
}

/**
 * Extract specific EXIF groups with targeted commands
 */
export async function extractSpecificExifGroups(
  buffer: Buffer,
  groups: string[] = ["EXIF", "GPS", "XMP", "IPTC"]
): Promise<any> {
  const tempFile = await temporaryFile({ extension: "jpg" });

  try {
    await writeFile(tempFile, buffer);

    const command = getExifToolCommand();
    const groupFlags = groups.map((group) => `-${group}:all`).join(" ");

    const exifToolCommand = `${command} -json ${groupFlags} -groupNames -coordFormat "%.8f" "${tempFile}"`;

    const { stdout, stderr } = await execAsync(exifToolCommand, {
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });

    if (stderr && !stderr.includes("Warning")) {
      console.warn("ExifTool stderr:", stderr);
    }

    const exifData = JSON.parse(stdout);
    return exifData[0] || {};
  } finally {
    try {
      await unlink(tempFile);
    } catch (cleanupError) {
      console.warn("Failed to cleanup temp file:", cleanupError);
    }
  }
}

/**
 * Extract only distance-related metadata for performance
 */
export async function extractDistanceMetadata(buffer: Buffer): Promise<any> {
  const tempFile = await temporaryFile({ extension: "jpg" });

  try {
    await writeFile(tempFile, buffer);

    const command = getExifToolCommand();

    // Target specific distance-related tags
    const distanceTags = [
      "SubjectDistance",
      "FocusDistance",
      "HyperfocalDistance",
      "UserComment",
      "ImageDescription",
      "XMP:Description",
      "GPS:GPSDestDistance",
    ]
      .map((tag) => `-${tag}`)
      .join(" ");

    const exifToolCommand = `${command} -json ${distanceTags} -groupNames "${tempFile}"`;

    const { stdout } = await execAsync(exifToolCommand);
    const exifData = JSON.parse(stdout);

    return exifData[0] || {};
  } finally {
    try {
      await unlink(tempFile);
    } catch (cleanupError) {
      console.warn("Failed to cleanup temp file:", cleanupError);
    }
  }
}

/**
 * Extract metadata from file path (for batch processing)
 */
export async function extractExifFromFile(filePath: string): Promise<any> {
  try {
    const command = getExifToolCommand();
    const exifToolCommand = `${command} -json -All -groupNames -coordFormat "%.8f" "${filePath}"`;

    const { stdout, stderr } = await execAsync(exifToolCommand, {
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr && !stderr.includes("Warning")) {
      console.warn("ExifTool stderr:", stderr);
    }

    const exifData = JSON.parse(stdout);
    return exifData[0] || {};
  } catch (error) {
    console.error(`ExifTool failed for file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Search for distance information in EXIF data
 */
export function findDistanceInExif(exifData: any): {
  distance: number;
  source: string;
  confidence: "high" | "medium" | "low";
  raw_value?: any;
} {
  // Priority order for distance fields
  const distanceFields = [
    // High confidence: User comments and descriptions
    { field: "UserComment", confidence: "high" as const },
    { field: "EXIF:UserComment", confidence: "high" as const },
    { field: "ImageDescription", confidence: "high" as const },
    { field: "XMP:Description", confidence: "high" as const },
    { field: "Comments", confidence: "high" as const },

    // Medium confidence: Measured distances
    { field: "SubjectDistance", confidence: "medium" as const },
    { field: "EXIF:SubjectDistance", confidence: "medium" as const },
    { field: "Composite:SubjectDistance", confidence: "medium" as const },
    { field: "XMP:SubjectDistance", confidence: "medium" as const },

    // Lower confidence: Focus-related distances
    { field: "FocusDistance", confidence: "low" as const },
    { field: "HyperfocalDistance", confidence: "low" as const },
  ];

  // Search text fields for distance patterns
  for (const { field, confidence } of distanceFields.slice(0, 5)) {
    const value = exifData[field];
    if (typeof value === "string") {
      const patterns = [
        /(?:distance|range|dist)[:=]?\s*([\d.]+)\s*m?(?:eter)?s?/i,
        /([\d.]+)\s*m(?:eter)?s?\s*(?:distance|range|to|away)/i,
        /(?:blade|subject|target)[:=]?\s*([\d.]+)\s*m?/i,
        /^([\d.]+)\s*m$/i, // Simple "30m" format
      ];

      for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) {
          const distance = parseFloat(match[1]);
          if (!isNaN(distance) && distance > 0 && distance < 1000) {
            // Reasonable range
            return {
              distance,
              source: field,
              confidence,
              raw_value: value,
            };
          }
        }
      }
    }
  }

  // Search numeric fields
  for (const { field, confidence } of distanceFields.slice(5)) {
    const value = exifData[field];
    if (typeof value === "number" && value > 0 && value < 1000) {
      return {
        distance: value,
        source: field,
        confidence,
        raw_value: value,
      };
    }
  }

  return {
    distance: 0,
    source: "not_found",
    confidence: "low",
  };
}

/**
 * Batch process multiple files with ExifTool
 */
export async function batchExtractExif(filePaths: string[]): Promise<any[]> {
  try {
    const command = getExifToolCommand();
    const quotedPaths = filePaths.map((path) => `"${path}"`).join(" ");
    const exifToolCommand = `${command} -json -All -groupNames -coordFormat "%.8f" ${quotedPaths}`;

    const { stdout, stderr } = await execAsync(exifToolCommand, {
      maxBuffer: 1024 * 1024 * 50, // 50MB for batch processing
    });

    if (stderr && !stderr.includes("Warning")) {
      console.warn("Batch ExifTool stderr:", stderr);
    }

    return JSON.parse(stdout);
  } catch (error) {
    console.error("Batch ExifTool execution failed:", error);
    throw error;
  }
}

/**
 * Validate ExifTool output and provide diagnostics
 */
export function validateExifData(
  exifData: any,
  filename: string
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!exifData || Object.keys(exifData).length === 0) {
    issues.push("No EXIF data found");
    suggestions.push("Check if the file contains EXIF metadata");
    return { isValid: false, issues, suggestions };
  }

  // Check for essential fields
  if (!exifData.Make && !exifData["EXIF:Make"]) {
    issues.push("Camera make not found");
  }

  if (!exifData.Model && !exifData["EXIF:Model"]) {
    issues.push("Camera model not found");
  }

  if (!exifData.FocalLength && !exifData["EXIF:FocalLength"]) {
    issues.push("Focal length not found");
  }

  // Check for GPS data
  if (!exifData.GPSLatitude && !exifData["GPS:GPSLatitude"]) {
    issues.push("GPS coordinates not found");
    suggestions.push("Ensure GPS was enabled during image capture");
  }

  // Check for distance information
  const distanceInfo = findDistanceInExif(exifData);
  if (distanceInfo.distance === 0) {
    issues.push("Distance information not found");
    suggestions.push(
      "Consider adding distance info to image metadata or providing manual distance"
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}
