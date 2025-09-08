// next-turbine-app/lib/turbine-api.ts

import { TurbineImage } from "@/types";

export async function fetchTurbineData(): Promise<TurbineImage[]> {
  try {
    const response = await fetch("/turbine-data.json", {
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Ensure we always return an array
    if (Array.isArray(data)) {
      return data;
    } else {
      console.error("Data is not an array:", typeof data, data);
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching turbine data:", error);
    return [];
  }
}

/**
 * Get images filtered by blade and side
 */
export async function fetchFilteredImages(
  blade: "A" | "B" | "C",
  side: "TE" | "PS" | "LE" | "SS"
): Promise<TurbineImage[]> {
  const allImages = await fetchTurbineData();
  return allImages.filter((img) => img.blade === blade && img.side === side);
}

/**
 * Get image counts by blade and side
 */
export async function getImageCounts(): Promise<{
  byBlade: Record<"A" | "B" | "C", number>;
  bySide: Record<"TE" | "PS" | "LE" | "SS", number>;
  total: number;
}> {
  const allImages = await fetchTurbineData();

  const byBlade = { A: 0, B: 0, C: 0 };
  const bySide = { TE: 0, PS: 0, LE: 0, SS: 0 };

  allImages.forEach((img) => {
    if (img && img.blade && byBlade.hasOwnProperty(img.blade)) {
      byBlade[img.blade]++;
    }
    if (img && img.side && bySide.hasOwnProperty(img.side)) {
      bySide[img.side]++;
    }
  });

  return {
    byBlade,
    bySide,
    total: allImages.length,
  };
}
