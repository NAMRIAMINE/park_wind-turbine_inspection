// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { TurbineImage, UploadMetadata } from "@/types";
import fs from "fs";

const execAsync = promisify(exec);

// Enhanced distance extraction with better patterns
function extractBladeDistance(exifData: any): {
  distance: number;
  source: string;
  confidence: "high" | "medium" | "low";
  raw_value?: any;
} {
  // High confidence: User comments and descriptions with explicit distance patterns
  const userCommentFields = [
    "EXIF:UserComment",
    "UserComment",
    "Comment",
    "XMP:UserComment",
    "IPTC:SpecialInstructions",
    "ImageDescription",
    "XMP:Description",
  ];

  for (const field of userCommentFields) {
    const userComment = exifData[field];
    if (userComment && typeof userComment === "string" && userComment.trim()) {
      // Enhanced distance patterns
      const patterns = [
        /(?:distance|dist|range)[:=\s]*(\d+\.?\d*)\s*m(?:eter)?s?/i,
        /(\d+\.?\d*)\s*m(?:eter)?s?\s*(?:distance|dist|range|to|away)/i,
        /(?:blade|subject|target)[:=\s]*(\d+\.?\d*)\s*m/i,
        /^(\d+\.?\d*)\s*m$/i, // Simple "30m" format
        /(\d+\.?\d*)\s*meters?\s*(?:to|from|away)/i,
      ];

      for (const pattern of patterns) {
        const match = userComment.match(pattern);
        if (match) {
          const distance = parseFloat(match[1]);
          if (!isNaN(distance) && distance > 0.1 && distance < 200) {
            return {
              distance,
              source: field,
              confidence: "high",
              raw_value: userComment,
            };
          }
        }
      }
    }
  }

  // Medium confidence: Subject distance fields
  const subjectDistanceFields = [
    "EXIF:SubjectDistance",
    "SubjectDistance",
    "Camera:SubjectDistance",
  ];

  for (const field of subjectDistanceFields) {
    const subjectDistance = exifData[field];
    if (subjectDistance && !isNaN(parseFloat(subjectDistance))) {
      const distance = parseFloat(subjectDistance);
      // Only accept reasonable ranges for blade inspection
      if (distance > 0.5 && distance < 100) {
        return {
          distance,
          source: field,
          confidence: "medium",
          raw_value: subjectDistance,
        };
      }
    }
  }

  // No distance found
  return {
    distance: 0,
    source: "not_found",
    confidence: "low",
  };
}

// Calculate statistics from existing images for interpolation
function calculateDistanceStatistics(
  images: TurbineImage[],
  blade: string,
  side: string
): {
  meanDistance: number;
  medianDistance: number;
  validDistances: number[];
  confidence: "high" | "medium" | "low";
} {
  // Filter to same blade and side for better accuracy
  const sameBladeImages = images.filter(
    (img) =>
      img.blade === blade &&
      img.side === side &&
      img.gsd?.distance_to_blade > 0 &&
      img.gsd?.distance_confidence !== "low"
  );

  // Fall back to all images if not enough same-blade data
  const relevantImages =
    sameBladeImages.length >= 3
      ? sameBladeImages
      : images.filter(
          (img) =>
            img.gsd?.distance_to_blade > 0 &&
            img.gsd?.distance_confidence !== "low"
        );

  const validDistances = relevantImages.map((img) => img.gsd.distance_to_blade);

  if (validDistances.length === 0) {
    return {
      meanDistance: 0,
      medianDistance: 0,
      validDistances: [],
      confidence: "low",
    };
  }

  const sortedDistances = [...validDistances].sort((a, b) => a - b);
  const meanDistance =
    validDistances.reduce((sum, d) => sum + d, 0) / validDistances.length;
  const medianDistance =
    sortedDistances[Math.floor(sortedDistances.length / 2)];

  // Determine confidence based on data quality
  let confidence: "high" | "medium" | "low" = "medium";

  if (validDistances.length >= 5) {
    const stdDev = Math.sqrt(
      validDistances.reduce(
        (sum, d) => sum + Math.pow(d - meanDistance, 2),
        0
      ) / validDistances.length
    );

    // High confidence if we have many samples with low variation
    if (stdDev < meanDistance * 0.1) {
      // Less than 10% variation
      confidence = "high";
    }
  } else if (validDistances.length < 3) {
    confidence = "low";
  }

  return {
    meanDistance,
    medianDistance,
    validDistances: sortedDistances,
    confidence,
  };
}

// Enhanced GSD calculation with interpolated distance support
function calculateGSDForTurbine(
  exifData: any,
  imageWidth: number,
  imageHeight: number,
  distanceToBladeMeters: number,
  distanceSource: string = "calculated",
  distanceConfidence: "high" | "medium" | "low" = "medium"
): {
  gsd_width: number;
  gsd_height: number;
  gsd_cm_per_pixel: number;
  flight_height: number;
  distance_to_blade: number;
  altitude_source: string;
  distance_source: string;
  distance_confidence: "high" | "medium" | "low";
} {
  const make = exifData["EXIF:Make"] || exifData.Make || "DJI";
  const model = exifData["EXIF:Model"] || exifData.Model || "M3E";

  const cameraSpecs = getCameraSpecs(make, model, exifData);
  const {
    focal_length: focalLength,
    sensor_width: sensorWidth,
    sensor_height: sensorHeight,
  } = cameraSpecs;

  // Validate inputs
  if (distanceToBladeMeters <= 0) {
    throw new Error("Invalid distance to blade: must be greater than 0");
  }

  // Calculate GSD
  const gsd_width_m_per_px =
    (sensorWidth * distanceToBladeMeters) / (focalLength * imageWidth);
  const gsd_height_m_per_px =
    (sensorHeight * distanceToBladeMeters) / (focalLength * imageHeight);
  const gsd_avg_m_per_px = (gsd_width_m_per_px + gsd_height_m_per_px) / 2;
  const gsd_cm_per_pixel = gsd_avg_m_per_px * 100;

  // Get altitude
  const altitudeData =
    exifData["XMP:RelativeAltitude"] ||
    exifData.RelativeAltitude ||
    exifData["GPS:GPSAltitude"] ||
    exifData.GPSAltitude ||
    "0";

  const altitudeAboveGround =
    parseFloat(altitudeData.toString().replace(/[^\d.-]/g, "")) || 0;

  return {
    gsd_width: gsd_width_m_per_px,
    gsd_height: gsd_height_m_per_px,
    gsd_cm_per_pixel,
    flight_height: altitudeAboveGround,
    distance_to_blade: distanceToBladeMeters,
    altitude_source:
      altitudeAboveGround > 0 ? "relative_altitude" : "estimated",
    distance_source: distanceSource,
    distance_confidence: distanceConfidence,
  };
}

// Load existing images for distance interpolation
async function loadExistingImages(): Promise<TurbineImage[]> {
  try {
    const dataFile = join(process.cwd(), "public", "turbine-data.json");
    if (fs.existsSync(dataFile)) {
      const jsonData = await fs.promises.readFile(dataFile, "utf-8");
      const images = JSON.parse(jsonData);
      return Array.isArray(images) ? images : [];
    }
  } catch (error) {
    console.warn("Could not load existing images for interpolation:", error);
  }
  return [];
}

// Get camera specifications
function getCameraSpecs(
  make: string,
  model: string,
  exifData: any
): {
  focal_length: number;
  sensor_width: number;
  sensor_height: number;
} {
  const focalLengthRaw =
    exifData["EXIF:FocalLength"] ||
    exifData.FocalLength ||
    exifData["Camera:FocalLength"] ||
    "12.29 mm";

  let focalLength = 12.29;
  if (typeof focalLengthRaw === "string") {
    const match = focalLengthRaw.match(/([\d.]+)/);
    if (match) focalLength = parseFloat(match[1]);
  } else if (typeof focalLengthRaw === "number") {
    focalLength = focalLengthRaw;
  }

  const makeUpper = make.toUpperCase();
  const modelUpper = model.toUpperCase();

  if (makeUpper.includes("DJI")) {
    if (
      modelUpper.includes("M3E") ||
      modelUpper.includes("MAVIC 3 ENTERPRISE")
    ) {
      return {
        focal_length: focalLength,
        sensor_width: 17.3,
        sensor_height: 13.0,
      };
    } else if (modelUpper.includes("M3") || modelUpper.includes("MAVIC 3")) {
      return {
        focal_length: focalLength,
        sensor_width: 17.3,
        sensor_height: 13.0,
      };
    } else if (modelUpper.includes("MINI") || modelUpper.includes("M2")) {
      return {
        focal_length: focalLength,
        sensor_width: 6.17,
        sensor_height: 4.55,
      };
    } else if (modelUpper.includes("AIR")) {
      return {
        focal_length: focalLength,
        sensor_width: 6.4,
        sensor_height: 4.8,
      };
    }
  }

  return { focal_length: focalLength, sensor_width: 17.3, sensor_height: 13.0 };
}

function extractBladeAndSide(
  filename: string,
  metadata?: UploadMetadata
): {
  blade: "A" | "B" | "C";
  side: "TE" | "PS" | "LE" | "SS";
} {
  if (metadata) {
    return { blade: metadata.blade, side: metadata.side };
  }

  const upperFilename = filename.toUpperCase();

  let blade: "A" | "B" | "C" = "A";
  if (upperFilename.includes("-A-") || upperFilename.includes("_A_"))
    blade = "A";
  else if (upperFilename.includes("-B-") || upperFilename.includes("_B_"))
    blade = "B";
  else if (upperFilename.includes("-C-") || upperFilename.includes("_C_"))
    blade = "C";

  let side: "TE" | "PS" | "LE" | "SS" = "TE";
  if (upperFilename.includes("-TE-") || upperFilename.includes("_TE_"))
    side = "TE";
  else if (upperFilename.includes("-PS-") || upperFilename.includes("_PS_"))
    side = "PS";
  else if (upperFilename.includes("-LE-") || upperFilename.includes("_LE_"))
    side = "LE";
  else if (upperFilename.includes("-SS-") || upperFilename.includes("_SS_"))
    side = "SS";

  return { blade, side };
}

async function extractExifWithDirectExifTool(filePath: string): Promise<any> {
  try {
    const exifToolCommand = `exiftool -json -All -groupNames -duplicates -struct -coordFormat "%.8f" "${filePath}"`;
    const { stdout, stderr } = await execAsync(exifToolCommand, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 30000,
    });

    if (stderr && !stderr.includes("Warning")) {
      console.warn("ExifTool stderr:", stderr);
    }

    const exifData = JSON.parse(stdout);
    return exifData[0] || {};
  } catch (error) {
    console.error("❌ Direct ExifTool execution failed:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), "public", "uploads");
    const thumbnailsDir = join(uploadsDir, "thumbnails");

    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });
    if (!existsSync(thumbnailsDir))
      await mkdir(thumbnailsDir, { recursive: true });

    // Load existing images for distance interpolation
    const existingImages = await loadExistingImages();

    const processedImages: TurbineImage[] = [];
    const errors: string[] = [];
    const interpolationLog: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadataStr = formData.get(`metadata_${i}`) as string;

      try {
        let metadata: UploadMetadata | undefined;
        if (metadataStr) {
          try {
            metadata = JSON.parse(metadataStr);
          } catch (e) {
            console.warn(`⚠️ Invalid metadata for ${file.name}`);
          }
        }

        const { blade, side } = extractBladeAndSide(file.name, metadata);
        const timestamp = Date.now();
        const fileExtension =
          file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filename = `${blade}_${side}_${timestamp}_${i}.${fileExtension}`;
        const thumbnailFilename = `${blade}_${side}_${timestamp}_${i}_thumb.jpg`;

        const filepath = join(uploadsDir, filename);
        const thumbnailPath = join(thumbnailsDir, thumbnailFilename);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        await writeFile(filepath, buffer);
        await sharp(buffer)
          .resize(400, 300, { fit: "cover", position: "center" })
          .jpeg({ quality: 80, progressive: true })
          .toFile(thumbnailPath);

        const exifData = await extractExifWithDirectExifTool(filepath);
        if (!exifData || Object.keys(exifData).length === 0) {
          throw new Error("No EXIF data found");
        }

        const imageMetadata = await sharp(buffer).metadata();
        const width = imageMetadata.width || 5280;
        const height = imageMetadata.height || 3956;

        // Try to extract distance
        const bladeDistanceInfo = extractBladeDistance(exifData);
        let finalDistance = bladeDistanceInfo.distance;
        let finalDistanceSource = bladeDistanceInfo.source;
        let finalDistanceConfidence = bladeDistanceInfo.confidence;

        // Use manual distance if provided
        if (metadata?.manualDistance && metadata.manualDistance > 0) {
          if (finalDistance === 0) {
            finalDistance = metadata.manualDistance;
            finalDistanceSource = "manual_input";
            finalDistanceConfidence = "high";
          } else {
            throw new Error(
              "Manual distance provided but no distance found in EXIF metadata. " +
                "Please add distance information to the image metadata or provide manual distance during upload."
            );
          }
        }

        // If no distance found, use interpolation from existing images
        if (finalDistance === 0) {
          const stats = calculateDistanceStatistics(
            existingImages,
            blade,
            side
          );

          if (stats.meanDistance > 0) {
            finalDistance = stats.medianDistance; // Use median for better stability
            finalDistanceSource = `interpolated_from_${stats.validDistances.length}_images`;
            finalDistanceConfidence =
              stats.confidence === "high" ? "medium" : "low"; // Downgrade confidence

            interpolationLog.push(
              `${file.name}: Used interpolated distance ${finalDistance.toFixed(
                2
              )}m ` +
                `(median of ${
                  stats.validDistances.length
                } similar images, range: ${Math.min(
                  ...stats.validDistances
                ).toFixed(1)}-${Math.max(...stats.validDistances).toFixed(1)}m)`
            );
          } else {
            throw new Error(
              "No distance to blade found in EXIF metadata and no existing images available for interpolation. " +
                "Please add distance information to the image metadata or provide manual distance during upload."
            );
          }
        }

        // Validate final distance
        if (finalDistance < 0.5 || finalDistance > 100) {
          throw new Error(
            `Distance to blade (${finalDistance}m) is outside reasonable range (0.5m - 100m). Please check the distance data.`
          );
        }

        const gsdData = calculateGSDForTurbine(
          exifData,
          width,
          height,
          finalDistance,
          finalDistanceSource,
          finalDistanceConfidence
        );

        // Validate GSD
        if (gsdData.gsd_cm_per_pixel < 0.001 || gsdData.gsd_cm_per_pixel > 50) {
          throw new Error(
            `Calculated GSD (${gsdData.gsd_cm_per_pixel.toFixed(
              4
            )} cm/pixel) is unrealistic. Please check camera and distance data.`
          );
        }

        const make = exifData["EXIF:Make"] || exifData.Make || "DJI";
        const model = exifData["EXIF:Model"] || exifData.Model || "M3E";
        const cameraSpecs = getCameraSpecs(make, model, exifData);

        const turbineImage: TurbineImage = {
          id: `${blade}_${side}_${timestamp}_${i}`,
          name: file.name,
          orig_img_src: `/uploads/${filename}`,
          thumbnail_src: `/uploads/thumbnails/${thumbnailFilename}`,
          width,
          height,
          blade,
          side,
          camera: {
            make,
            model,
            focal_length: cameraSpecs.focal_length,
            sensor_width: cameraSpecs.sensor_width,
            sensor_height: cameraSpecs.sensor_height,
          },
          gsd: gsdData,
          date:
            exifData["EXIF:DateTime"] ||
            exifData.DateTime ||
            exifData["EXIF:DateTimeOriginal"] ||
            new Date().toISOString(),
        };

        processedImages.push(turbineImage);
      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error);
        errors.push(
          `${file.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (processedImages.length === 0) {
      return NextResponse.json(
        {
          error: "No images were successfully processed",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Save all images
    const allImages = [...existingImages, ...processedImages];
    allImages.sort((a, b) => a.gsd.flight_height - b.gsd.flight_height);

    const dataFile = join(process.cwd(), "public", "turbine-data.json");
    await fs.promises.writeFile(dataFile, JSON.stringify(allImages, null, 2));

    // Prepare response with interpolation info
    const response: any = {
      success: true,
      processed: processedImages.length,
      total_images: allImages.length,
      message: `Successfully processed ${processedImages.length} images`,
      redirect_to: "/turbine",
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    if (interpolationLog.length > 0) {
      response.interpolation_log = interpolationLog;
      response.interpolated_count = interpolationLog.length;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
