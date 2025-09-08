// app/components/turbine/carousel-navigation.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Grid3X3, Target } from "lucide-react";
import { TurbineImage } from "@/types";
import Image from "next/image";

interface CarouselNavigationProps {
  currentIndex: number;
  totalImages: number;
  onPrevious: () => void;
  onNext: () => void;
  onJumpTo?: (index: number) => void;
  images?: TurbineImage[];
  measurements?: Record<string, number>;
}

export function CarouselNavigation({
  currentIndex,
  totalImages,
  onPrevious,
  onNext,
  onJumpTo,
  images = [],
  measurements = {},
}: CarouselNavigationProps) {
  const [showThumbnails, setShowThumbnails] = useState(false);

  const getBladeColor = (blade: "A" | "B" | "C") => {
    switch (blade) {
      case "A":
        return "bg-blue-500 text-white";
      case "B":
        return "bg-green-500 text-white";
      case "C":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getSideStyle = (side: string) => {
    const baseClasses = "text-xs px-1 py-0.5 rounded";
    switch (side) {
      case "TE":
        return `${baseClasses} bg-red-100 text-red-700`;
      case "LE":
        return `${baseClasses} bg-blue-100 text-blue-700`;
      case "PS":
        return `${baseClasses} bg-green-100 text-green-700`;
      case "SS":
        return `${baseClasses} bg-purple-100 text-purple-700`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`;
    }
  };

  const currentImage = images[currentIndex];

  return (
    <>
      <Button
        size="icon"
        className="absolute top-4 left-1/2 z-10 shadow-lg bg-white"
        onClick={onPrevious}
        disabled={currentIndex === 0}
      >
        <ChevronUp className="h-5 w-5" />
      </Button>

      <Button
        size="icon"
        className="absolute bottom-4 right-1/2 z-10 shadow-lg"
        onClick={onNext}
        disabled={currentIndex === totalImages - 1}
      >
        <ChevronDown className="h-5 w-5" />
      </Button>

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowThumbnails(!showThumbnails)}
          className="h-8 w-8 p-0"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        {currentImage && (
          <div className="flex items-center gap-2">
            <Badge className={getBladeColor(currentImage.blade)}>
              {currentImage.blade}
            </Badge>
            <span className={getSideStyle(currentImage.side)}>
              {currentImage.side}
            </span>
            {measurements[currentImage.id] > 0 && (
              <Badge
                variant="outline"
                className="text-green-600 border-green-300"
              >
                <Target className="h-3 w-3 mr-1" />
                {measurements[currentImage.id]}
              </Badge>
            )}
          </div>
        )}

        <div className="text-sm font-medium">
          {currentIndex + 1} / {totalImages}
        </div>
      </div>

      {showThumbnails && images.length > 0 && (
        <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
          <div className="rounded-lg p-4 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">All Images</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowThumbnails(false)}
              >
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? "border-blue-500 shadow-lg"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  onClick={() => {
                    onJumpTo?.(index);
                    setShowThumbnails(false);
                  }}
                >
                  <div className="aspect-square flex items-center justify-center">
                    <Image
                      src={image.thumbnail_src}
                      alt={`${image.blade}-${image.side}`}
                      width={100}
                      height={100}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                    <div className="flex justify-between">
                      <Badge
                        className={`text-xs ${getBladeColor(image.blade)}`}
                      >
                        {image.blade}
                      </Badge>
                      <span className={getSideStyle(image.side)}>
                        {image.side}
                      </span>
                    </div>

                    <div className="flex justify-between items-end">
                      <span className="text-white text-xs">#{index + 1}</span>
                      {measurements[image.id] > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-green-500 text-white"
                        >
                          <Target className="h-2 w-2 mr-1" />
                          {measurements[image.id]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {image.gsd && (
                    <div
                      className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                        image.gsd.distance_confidence === "high"
                          ? "bg-green-400"
                          : image.gsd.distance_confidence === "medium"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      title={`Distance Confidence: ${image.gsd.distance_confidence}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-4">
                <span>Distance Confidence: </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Low</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
