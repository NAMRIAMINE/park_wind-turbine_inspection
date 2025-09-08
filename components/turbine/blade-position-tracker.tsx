// app/components/turbine/blade-position-tracker.tsx
import React, { useMemo, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TurbineImage } from "@/types";

interface BladePositionTrackerProps {
  images: TurbineImage[];
  currentImageIndex: number;
  currentFilter: {
    blade: "A" | "B" | "C";
    side: "TE" | "PS" | "LE" | "SS";
  };
  onImageChange?: (index: number) => void;
}

export const BladePositionTracker = React.memo<BladePositionTrackerProps>(
  function BladePositionTracker({
    images,
    currentImageIndex,
    currentFilter,
    onImageChange,
  }) {
    const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const bladeData = useMemo(() => {
      if (images.length === 0) {
        return {
          lengthMeters: 0,
          lengthPixels: 0,
          minAltitude: 0,
          maxAltitude: 0,
          currentAltitude: 0,
          currentPosition: 0,
          currentPositionPixels: 0,
          totalImages: 0,
          sortedImages: [],
        };
      }

      // Sort images by altitude (ascending - bottom to top of blade)
      const sortedImages = [...images].sort((a, b) => {
        const altA = a.gsd?.flight_height || 0;
        const altB = b.gsd?.flight_height || 0;
        return altA - altB;
      });

      // Get altitudes
      const altitudes = sortedImages
        .map((img) => img.gsd?.flight_height || 0)
        .filter((alt) => alt > 0);

      if (altitudes.length === 0) {
        return {
          lengthMeters: 0,
          lengthPixels: 0,
          minAltitude: 0,
          maxAltitude: 0,
          currentAltitude: 0,
          currentPosition: 0,
          currentPositionPixels: 0,
          totalImages: images.length,
          sortedImages: [],
        };
      }

      const minAltitude = altitudes[0];
      const maxAltitude = altitudes[altitudes.length - 1];
      const lengthMeters = maxAltitude - minAltitude;

      // Scale factor for visual representation
      const pixelsPerMeter = 2.5;
      const lengthPixels = Math.max(
        250,
        Math.min(450, lengthMeters * pixelsPerMeter)
      );

      const currentImage = images[currentImageIndex];
      const currentAltitude = currentImage?.gsd?.flight_height || minAltitude;

      // Calculate relative position (0 = bottom/first image, 1 = top/last image)
      const currentPosition =
        lengthMeters > 0 ? (currentAltitude - minAltitude) / lengthMeters : 0;

      // Convert to pixels from top of visual blade
      const currentPositionPixels =
        lengthPixels - currentPosition * lengthPixels;

      return {
        lengthMeters,
        lengthPixels,
        minAltitude,
        maxAltitude,
        currentAltitude,
        currentPosition,
        currentPositionPixels: Math.max(
          6,
          Math.min(lengthPixels - 6, currentPositionPixels)
        ),
        totalImages: images.length,
        sortedImages,
      };
    }, [images, currentImageIndex]);

    const getBladeColor = (blade: "A" | "B" | "C") => {
      switch (blade) {
        case "A":
          return "from-blue-500 to-blue-600";
        case "B":
          return "from-green-500 to-green-600";
        case "C":
          return "from-orange-500 to-orange-600";
        default:
          return "from-gray-500 to-gray-600";
      }
    };

    const getBladeAccentColor = (blade: "A" | "B" | "C") => {
      switch (blade) {
        case "A":
          return "blue-500";
        case "B":
          return "green-500";
        case "C":
          return "orange-500";
        default:
          return "gray-500";
      }
    };

    // Handle click on blade to navigate to closest image
    const handleBladeClick = useCallback(
      (e: React.MouseEvent) => {
        if (!onImageChange || bladeData.totalImages === 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - rect.top;

        // Convert click position to relative position on blade (0 = top, 1 = bottom)
        const relativePosition = clickY / bladeData.lengthPixels;

        // Convert to altitude
        const targetAltitude =
          bladeData.maxAltitude - relativePosition * bladeData.lengthMeters;

        // Find closest image to target altitude
        let closestIndex = 0;
        let closestDistance = Math.abs(
          (bladeData.sortedImages[0]?.gsd?.flight_height || 0) - targetAltitude
        );

        bladeData.sortedImages.forEach((img, index) => {
          const distance = Math.abs(
            (img.gsd?.flight_height || 0) - targetAltitude
          );
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        // Find the index in the original images array
        const targetImage = bladeData.sortedImages[closestIndex];
        const originalIndex = images.findIndex(
          (img) => img.id === targetImage.id
        );

        if (originalIndex !== -1) {
          onImageChange(originalIndex);
        }
      },
      [onImageChange, bladeData, images]
    );

    // Handle hover for preview
    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (bladeData.totalImages === 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const hoverY = e.clientY - rect.top;
        const relativePosition = hoverY / bladeData.lengthPixels;

        // Convert to altitude for display
        const hoverAltitude =
          bladeData.maxAltitude - relativePosition * bladeData.lengthMeters;

        setHoveredPosition(hoverAltitude);
      },
      [bladeData]
    );

    const handleMouseLeave = useCallback(() => {
      setHoveredPosition(null);
    }, []);

    if (bladeData.totalImages === 0) {
      return (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-center">
              Blade Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">No images available</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4">
          {/* Interactive Blade Visual */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Clickable blade container */}
              <div
                className={`relative overflow-hidden cursor-pointer transition-all duration-200 ${
                  isInteracting ? "scale-105" : ""
                }`}
                style={{
                  width: "40px",
                  height: `${bladeData.lengthPixels}px`,
                  backgroundImage: `url('/turbine-blade.png')`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
                onClick={handleBladeClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={() => setIsInteracting(true)}
                onMouseDown={() => setIsInteracting(true)}
                onMouseUp={() => setIsInteracting(false)}
              >
                {/* Progress indicator */}
                <div
                  className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${getBladeColor(
                    currentFilter.blade
                  )} opacity-25 transition-all duration-300`}
                  style={{ height: `${bladeData.currentPosition * 100}%` }}
                />

                {/* Image position markers */}
                {bladeData.sortedImages.map((img, index) => {
                  const altitude = img.gsd?.flight_height || 0;
                  const position =
                    (altitude - bladeData.minAltitude) / bladeData.lengthMeters;
                  const pixelPosition =
                    bladeData.lengthPixels - position * bladeData.lengthPixels;
                  const isCurrent = img.id === images[currentImageIndex]?.id;

                  return (
                    <div
                      key={img.id}
                      className={`absolute left-0 right-0 transition-all duration-200 ${
                        isCurrent &&
                        `bg-${getBladeAccentColor(currentFilter.blade)}`
                      }`}
                      style={{
                        top: `${pixelPosition - 2}px`,
                        opacity: isCurrent ? 1 : 0.6,
                        height: isCurrent ? "4px" : "2px",
                      }}
                    />
                  );
                })}

                {/* Current position indicator */}
                <div
                  className={`absolute left-0 right-0 bg-${getBladeAccentColor(
                    currentFilter.blade
                  )} border-2 border-white shadow-lg transition-all duration-300 z-10 rounded-sm`}
                  style={{
                    height: "8px",
                    top: `${bladeData.currentPositionPixels - 4}px`,
                  }}
                >
                  <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
                    <div
                      className={`w-0 h-0 border-l-4 border-l-${getBladeAccentColor(
                        currentFilter.blade
                      )} border-t-2 border-b-2 border-t-transparent border-b-transparent`}
                    ></div>
                  </div>
                </div>

                {/* Hover position indicator */}
                {hoveredPosition !== null && (
                  <div
                    className="absolute left-0 right-0 bg-white/80 border border-gray-400 shadow-sm z-20"
                    style={{
                      height: "2px",
                      top: `${
                        ((bladeData.maxAltitude - hoveredPosition) /
                          bladeData.lengthMeters) *
                          bladeData.lengthPixels -
                        1
                      }px`,
                    }}
                  />
                )}
              </div>

              {/* Altitude markers */}
              <div className="absolute -left-16 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500">
                <div className="bg-white px-2 py-1 rounded shadow-sm border text-xs font-mono">
                  {bladeData.maxAltitude.toFixed(0)}m
                </div>
                <div className="bg-white px-2 py-1 rounded shadow-sm border text-xs font-mono">
                  {bladeData.minAltitude.toFixed(0)}m
                </div>
              </div>

              {/* Hover altitude display */}
              {hoveredPosition !== null && (
                <div
                  className="absolute -right-16 bg-blue-600 text-white px-2 py-1 rounded text-xs font-mono shadow-lg z-30"
                  style={{
                    top: `${
                      ((bladeData.maxAltitude - hoveredPosition) /
                        bladeData.lengthMeters) *
                        bladeData.lengthPixels -
                      12
                    }px`,
                  }}
                >
                  {hoveredPosition.toFixed(1)}m
                </div>
              )}
            </div>
          </div>

          {/* Stats and Instructions */}
          <div className="text-center space-y-2">
            <div className="text-xs text-gray-500 space-y-1">
              <div>Length: {bladeData.lengthMeters.toFixed(1)}m</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentImageIndex === nextProps.currentImageIndex &&
      prevProps.images.length === nextProps.images.length &&
      prevProps.currentFilter.blade === nextProps.currentFilter.blade &&
      prevProps.currentFilter.side === nextProps.currentFilter.side
    );
  }
);
