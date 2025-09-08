// app/api/turbine-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { TurbineImage, TurbineImagesSummary } from "@/types";

async function fetchTurbineData(
  blade?: "A" | "B" | "C",
  side?: "TE" | "PS" | "LE" | "SS"
): Promise<TurbineImage[]> {
  try {
    const dataFile = join(process.cwd(), "data", "turbine-images.json");
    const jsonData = await readFile(dataFile, "utf-8");
    const allImages: TurbineImage[] = JSON.parse(jsonData);

    // Filter by blade and side if specified
    let filteredImages = allImages;

    if (blade) {
      filteredImages = filteredImages.filter((img) => img.blade === blade);
    }

    if (side) {
      filteredImages = filteredImages.filter((img) => img.side === side);
    }

    // Sort by flight height (altitude above ground) - bottom to top
    return filteredImages.sort((a, b) => {
      const heightA = a.gsd?.flight_height || 0;
      const heightB = b.gsd?.flight_height || 0;
      return heightA - heightB;
    });
  } catch (error) {
    console.error("Error fetching turbine data:", error);
    return [];
  }
}

function calculateSummary(images: TurbineImage[]): TurbineImagesSummary {
  const summary: TurbineImagesSummary = {
    total: images.length,
    by_blade: { A: 0, B: 0, C: 0 },
    by_side: { TE: 0, PS: 0, LE: 0, SS: 0 },
    measurement_ready: 0,
    altitude_range: null,
    gsd_range: null,
  };

  if (images.length === 0) {
    return summary;
  }

  // Count by blade and side
  images.forEach((img) => {
    summary.by_blade[img.blade as keyof typeof summary.by_blade]++;
    summary.by_side[img.side as keyof typeof summary.by_side]++;
  });

  // Count measurement-ready images (with valid GSD)
  const measurementReady = images.filter(
    (img) => img.gsd?.gsd_cm_per_pixel && img.gsd.gsd_cm_per_pixel > 0
  );
  summary.measurement_ready = measurementReady.length;

  // Calculate altitude range
  const altitudes = images
    .map((img) => img.gsd?.flight_height)
    .filter((alt) => alt !== undefined && alt > 0) as number[];

  if (altitudes.length > 0) {
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    summary.altitude_range = {
      min: minAlt,
      max: maxAlt,
      span: maxAlt - minAlt,
    };
  }

  // Calculate GSD range
  const gsdValues = measurementReady
    .map((img) => img.gsd.gsd_cm_per_pixel)
    .filter((gsd) => gsd > 0);

  if (gsdValues.length > 0) {
    const minGSD = Math.min(...gsdValues);
    const maxGSD = Math.max(...gsdValues);
    const avgGSD =
      gsdValues.reduce((sum, gsd) => sum + gsd, 0) / gsdValues.length;

    summary.gsd_range = {
      min: minGSD,
      max: maxGSD,
      average: avgGSD,
    };
  }

  return summary;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const blade = searchParams.get("blade") as "A" | "B" | "C" | null;
  const side = searchParams.get("side") as "TE" | "PS" | "LE" | "SS" | null;
  const sortBy = searchParams.get("sortBy") as
    | "altitude"
    | "distance"
    | "timestamp"
    | "gsd"
    | null;
  const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null;
  const measurementReady = searchParams.get("measurementReady") === "true";

  try {
    let images = await fetchTurbineData(blade || undefined, side || undefined);

    // Filter measurement-ready images if requested
    if (measurementReady) {
      images = images.filter(
        (img) => img.gsd?.gsd_cm_per_pixel && img.gsd.gsd_cm_per_pixel > 0
      );
    }

    // Apply sorting
    const sortField = sortBy || "altitude";
    const order = sortOrder || "asc";

    images.sort((a, b) => {
      let valueA: number;
      let valueB: number;

      switch (sortField) {
        case "altitude":
          valueA = a.gsd?.flight_height || 0;
          valueB = b.gsd?.flight_height || 0;
          break;
        case "distance":
          valueA = a.gsd?.distance_to_blade || 0;
          valueB = b.gsd?.distance_to_blade || 0;
          break;
        case "gsd":
          valueA = a.gsd?.gsd_cm_per_pixel || 0;
          valueB = b.gsd?.gsd_cm_per_pixel || 0;
          break;
        case "timestamp":
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        default:
          valueA = a.gsd?.flight_height || 0;
          valueB = b.gsd?.flight_height || 0;
      }

      return order === "desc" ? valueB - valueA : valueA - valueB;
    });

    // Calculate summary for all images (not just filtered ones)
    const allImages = await fetchTurbineData();
    const summary = calculateSummary(allImages);

    return NextResponse.json({
      images,
      summary,
      filters: {
        blade,
        side,
        sortBy: sortField,
        sortOrder: order,
        measurementReady,
      },
      metadata: {
        total_filtered: images.length,
        total_all: allImages.length,
        measurement_ready_filtered: images.filter(
          (img) => img.gsd?.gsd_cm_per_pixel && img.gsd.gsd_cm_per_pixel > 0
        ).length,
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch turbine images" },
      { status: 500 }
    );
  }
}

// POST endpoint for getting measurement data for specific images
export async function POST(request: NextRequest) {
  try {
    const { imageIds } = await request.json();

    if (!Array.isArray(imageIds)) {
      return NextResponse.json(
        { error: "imageIds must be an array" },
        { status: 400 }
      );
    }

    const allImages = await fetchTurbineData();
    const selectedImages = allImages.filter((img) => imageIds.includes(img.id));

    const measurements = selectedImages.map((img) => ({
      id: img.id,
      name: img.name,
      blade: img.blade,
      side: img.side,
      gsd_cm_per_pixel: img.gsd?.gsd_cm_per_pixel || 0,
      distance_to_blade: img.gsd?.distance_to_blade || 0,
      altitude_above_ground: img.gsd?.flight_height || 0,
      distance_confidence: img.gsd?.distance_confidence || "low",
      measurement_ready: (img.gsd?.gsd_cm_per_pixel || 0) > 0,
      image_size: {
        width: img.width,
        height: img.height,
      },
      capture_date: img.date,
    }));

    // Calculate statistics for selected images
    const measurementReady = measurements.filter((m) => m.measurement_ready);
    const avgGSD =
      measurementReady.length > 0
        ? measurementReady.reduce((sum, m) => sum + m.gsd_cm_per_pixel, 0) /
          measurementReady.length
        : 0;

    const altitudes = measurements
      .map((m) => m.altitude_above_ground)
      .filter((alt) => alt > 0);
    const altitudeRange =
      altitudes.length > 0
        ? { min: Math.min(...altitudes), max: Math.max(...altitudes) }
        : null;

    return NextResponse.json({
      measurements,
      summary: {
        total_selected: selectedImages.length,
        measurement_ready: measurementReady.length,
        average_gsd_cm_per_pixel: avgGSD.toFixed(2),
        altitude_coverage: altitudeRange,
        blades_represented: [...new Set(measurements.map((m) => m.blade))],
        sides_represented: [...new Set(measurements.map((m) => m.side))],
        confidence_breakdown: {
          high: measurements.filter((m) => m.distance_confidence === "high")
            .length,
          medium: measurements.filter((m) => m.distance_confidence === "medium")
            .length,
          low: measurements.filter((m) => m.distance_confidence === "low")
            .length,
        },
      },
    });
  } catch (error) {
    console.error("Measurement API Error:", error);
    return NextResponse.json(
      { error: "Failed to get measurement data" },
      { status: 500 }
    );
  }
}
