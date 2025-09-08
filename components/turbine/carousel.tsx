// app/components/turbine/carousel.tsx
"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { TurbineImage, Measurement } from "@/types";
import { CarouselImageDisplay } from "@/components/turbine/carousel-image-display";
import { CarouselMeasurement } from "@/components/turbine/carousel-measurement";
import { CarouselNavigation } from "@/components/turbine/carousel-navigation";
import CursorRulerOverlay from "@/components/turbine/cursor-ruler-overlay";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Ruler,
  RotateCcw,
  Eye,
  EyeOff,
  Target,
  Move,
} from "lucide-react";
import { calculateBladeMetrics } from "@/lib/blade-utils";

interface TurbineCarouselProps {
  images: TurbineImage[];
  currentImageIndex: number;
  onImageChange: (index: number) => void;
  allImages?: TurbineImage[];
  currentFilter?: {
    blade: "A" | "B" | "C";
    side: "TE" | "PS" | "LE" | "SS";
  };
  viewState: {
    zoom: number;
    pan: { x: number; y: number };
    showRuler: boolean;
    showUI: boolean;
    measureMode: boolean;
    fullscreen: boolean;
  };
  onViewStateChange: (
    viewState: Partial<TurbineCarouselProps["viewState"]>
  ) => void;
  onZoom: (factor: number, focusPoint?: { x: number; y: number }) => void;
  onSetZoom: (zoom: number, focusPoint?: { x: number; y: number }) => void;
  onPan: (pan: { x: number; y: number }) => void;
  onResetView: () => void;
  measurements: Record<string, Measurement[]>;
  onUpdateMeasurements: (imageId: string, measurements: Measurement[]) => void;
  bladeContext?: any;
  settings: {
    animationDuration: number;
    rulerOpacity: number;
    showTooltips: boolean;
    measurementPrecision: number;
  };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const TurbineCarousel = React.memo<TurbineCarouselProps>(
  function TurbineCarousel({
    images,
    currentImageIndex,
    onImageChange,
    allImages = [],
    currentFilter,
    viewState,
    onViewStateChange,
    onZoom,
    onSetZoom,
    onPan,
    onResetView,
    measurements,
    onUpdateMeasurements,
    bladeContext,
    settings,
  }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    const debouncedZoom = useDebounce(viewState.zoom, 20);
    const debouncedPan = useDebounce(viewState.pan, 20);

    const currentImage = useMemo(() => {
      return images[currentImageIndex] || null;
    }, [images, currentImageIndex]);

    const measurementCounts = useMemo(() => {
      return Object.fromEntries(
        Object.entries(measurements).map(([id, measurements]) => [
          id,
          measurements.length,
        ])
      );
    }, [measurements]);

    // Calculate blade context for absolute positioning
    const enhancedBladeContext = useMemo(() => {
      if (!allImages.length || !currentFilter) return null;

      const filteredImages = allImages.filter(
        (img) =>
          img.blade === currentFilter.blade && img.side === currentFilter.side
      );

      const bladeMetrics = calculateBladeMetrics(filteredImages);
      const currentAltitude =
        currentImage?.gsd?.flight_height || bladeMetrics.minAltitude;

      return {
        ...bladeMetrics,
        currentAltitude,
        bladeLength: bladeMetrics.lengthMeters,
      };
    }, [allImages, currentFilter, currentImage]);

    const goToPrevious = useCallback(() => {
      if (currentImageIndex > 0) {
        onImageChange(currentImageIndex - 1);
      }
    }, [currentImageIndex, onImageChange]);

    const goToNext = useCallback(() => {
      if (currentImageIndex < images.length - 1) {
        onImageChange(currentImageIndex + 1);
      }
    }, [currentImageIndex, images.length, onImageChange]);

    const handlePanStart = useCallback(
      (e: React.MouseEvent) => {
        if (viewState.measureMode || viewState.zoom <= 1.1) return;
        setIsDragging(true);
        setDragStart({
          x: e.clientX - viewState.pan.x,
          y: e.clientY - viewState.pan.y,
        });
      },
      [viewState.measureMode, viewState.zoom, viewState.pan.x, viewState.pan.y]
    );

    const handlePanMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isDragging || viewState.measureMode || viewState.zoom <= 1.1)
          return;
        const newPan = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
        onPan(newPan);
      },
      [
        isDragging,
        viewState.measureMode,
        viewState.zoom,
        dragStart.x,
        dragStart.y,
        onPan,
      ]
    );

    const handlePanEnd = useCallback(() => {
      setIsDragging(false);
    }, []);

    const updateMeasurements = useCallback(
      (imageId: string, newMeasurements: Measurement[]) => {
        onUpdateMeasurements(imageId, newMeasurements);
      },
      [onUpdateMeasurements]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;

        switch (e.key) {
          case "ArrowLeft":
          case "ArrowUp":
            e.preventDefault();
            goToPrevious();
            break;
          case "ArrowRight":
          case "ArrowDown":
            e.preventDefault();
            goToNext();
            break;
          case "m":
          case "M":
            e.preventDefault();
            onViewStateChange({ measureMode: !viewState.measureMode });
            break;
          case "r":
          case "R":
            e.preventDefault();
            onViewStateChange({ showRuler: !viewState.showRuler });
            break;
          case "h":
          case "H":
            e.preventDefault();
            onViewStateChange({ showUI: !viewState.showUI });
            break;
          case "+":
          case "=":
            e.preventDefault();
            onZoom(1.3);
            break;
          case "-":
            e.preventDefault();
            onZoom(0.7);
            break;
          case "0":
            e.preventDefault();
            onResetView();
            break;
          case "Escape":
            e.preventDefault();
            onViewStateChange({ measureMode: false });
            break;
        }
      },
      [
        viewState.measureMode,
        viewState.showRuler,
        viewState.showUI,
        goToPrevious,
        goToNext,
        onZoom,
        onResetView,
        onViewStateChange,
      ]
    );

    useEffect(() => {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const handleWheel = useCallback(
      (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;

          // Calculate focus point for zoom
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const focusPoint = {
              x: e.clientX - rect.left - rect.width / 2,
              y: e.clientY - rect.top - rect.height / 2,
            };
            onZoom(zoomFactor, focusPoint);
          } else {
            onZoom(zoomFactor);
          }
        }
      },
      [onZoom]
    );

    useEffect(() => {
      const container = containerRef.current;
      if (container) {
        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
      }
    }, [handleWheel]);

    if (!images || images.length === 0) {
      return (
        <div className="h-full flex justify-center items-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-gray-600 text-lg">No images to display</p>
          </div>
        </div>
      );
    }

    if (!currentImage) {
      return (
        <div className="h-full flex justify-center items-center">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Image not found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col relative">
        {/* Enhanced Toolbar */}
        {viewState.showUI && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
            <div className="backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-3">
                {/* Measure Mode */}
                <Button
                  size="sm"
                  variant={viewState.measureMode ? "default" : "outline"}
                  onClick={() =>
                    onViewStateChange({ measureMode: !viewState.measureMode })
                  }
                  className={
                    viewState.measureMode
                      ? "bg-green-600 hover:bg-green-700 text-white shadow-lg border-0"
                      : "border-gray-300 hover:border-gray-400"
                  }
                  title="Toggle measurement mode (M)"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Measure
                  {measurements[currentImage.id]?.length > 0 && (
                    <span className="ml-2 bg-gray-700 text-white text-xs px-1.5 py-0.5 rounded">
                      {measurements[currentImage.id].length}
                    </span>
                  )}
                </Button>

                {/* Ruler Toggle */}
                <Button
                  size="sm"
                  variant={viewState.showRuler ? "default" : "outline"}
                  onClick={() =>
                    onViewStateChange({ showRuler: !viewState.showRuler })
                  }
                  className={
                    viewState.showRuler
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-0"
                      : "border-gray-300 hover:border-gray-400"
                  }
                  title="Toggle ruler (R)"
                >
                  {viewState.showRuler ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>

                {/* Pan Mode Indicator */}
                {viewState.zoom > 1.1 && !viewState.measureMode && (
                  <div className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    <Move className="h-3 w-3 mr-1" />
                    Drag to pan
                  </div>
                )}

                {/* Divider */}
                <div className="w-px h-8 bg-gray-200"></div>

                {/* Zoom Controls */}
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onZoom(0.7)}
                    disabled={viewState.zoom <= 0.5}
                    className="rounded-none px-3 h-8 disabled:opacity-40"
                    title="Zoom out (-)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <div className="px-3 text-sm font-mono border-x border-gray-200 min-w-[70px] text-center h-8 flex items-center">
                    {Math.round(viewState.zoom * 100)}%
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onZoom(1.3)}
                    disabled={viewState.zoom >= 5}
                    className="rounded-none px-3 h-8 disabled:opacity-40"
                    title="Zoom in (+)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>

                {/* Reset */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResetView}
                  className="border-gray-300 hover:border-gray-400"
                  title="Reset view and measurements (0)"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Image Area */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          <div
            ref={containerRef}
            className="w-full h-full relative"
            style={{
              cursor: viewState.measureMode
                ? "crosshair"
                : viewState.zoom > 1.1 && isDragging
                ? "grabbing"
                : viewState.zoom > 1.1
                ? "grab"
                : "zoom-in",
            }}
            onMouseDown={!viewState.measureMode ? handlePanStart : undefined}
            onMouseMove={!viewState.measureMode ? handlePanMove : undefined}
            onMouseUp={!viewState.measureMode ? handlePanEnd : undefined}
            onMouseLeave={!viewState.measureMode ? handlePanEnd : undefined}
          >
            {/* Enhanced Image Display */}
            <CarouselImageDisplay
              image={currentImage}
              zoom={debouncedZoom}
              pan={debouncedPan}
              isDragging={isDragging}
              onPanChange={onPan}
              onZoomChange={onSetZoom}
            />

            {/* Enhanced Cursor-Tracking Ruler Overlay */}
            {viewState.showRuler && currentImage.gsd?.gsd_cm_per_pixel > 0 && (
              <CursorRulerOverlay
                image={currentImage}
                zoom={debouncedZoom}
                pan={debouncedPan}
                containerRef={containerRef}
                allImages={allImages}
                currentFilter={currentFilter}
              />
            )}

            {/* Measurement Overlay */}
            {viewState.measureMode && (
              <CarouselMeasurement
                image={currentImage}
                measurements={measurements[currentImage.id] || []}
                onMeasurementsUpdate={(newMeasurements) =>
                  updateMeasurements(currentImage.id, newMeasurements)
                }
                zoom={debouncedZoom}
                pan={debouncedPan}
                bladeContext={enhancedBladeContext || undefined}
              />
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-shrink-0">
          <CarouselNavigation
            currentIndex={currentImageIndex}
            totalImages={images.length}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onJumpTo={onImageChange}
            images={images}
            measurements={measurementCounts}
          />
        </div>

        {/* Enhanced Help and Shortcuts */}
        {viewState.showUI && (
          <>
            {settings.showTooltips && (
              <div className="absolute bottom-20 right-4 bg-black/80 text-white p-3 rounded-lg text-xs z-20 shadow-lg">
                <div className="space-y-1">
                  <div className="font-semibold mb-2">Shortcuts</div>
                  <div>M - Measure • R - Ruler • H - Hide UI</div>
                  <div>
                    +/- - Zoom • 0 - Reset • Double-click - Zoom to point
                  </div>
                  <div>Ctrl+Wheel - Zoom • Arrows - Navigate</div>
                  <div>ESC - Exit measure mode</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* UI Toggle Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewStateChange({ showUI: !viewState.showUI })}
          className="absolute top-4 right-4 z-40 bg-white/90 hover:bg-white"
          title="Toggle UI visibility (H)"
        >
          {viewState.showUI ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>

        {/* Image quality indicator */}
        {currentImage.gsd && (
          <div className="absolute top-4 left-4 z-30">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    currentImage.gsd.distance_confidence === "high"
                      ? "bg-green-500"
                      : currentImage.gsd.distance_confidence === "medium"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  title={`Distance confidence: ${currentImage.gsd.distance_confidence}`}
                />
                <span className="text-gray-600">
                  GSD: {currentImage.gsd.gsd_cm_per_pixel.toFixed(3)} cm/px
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
