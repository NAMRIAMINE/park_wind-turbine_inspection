// app/components/turbine/carousel-toolbar.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Ruler, RotateCcw, Grid3X3 } from "lucide-react";

interface CarouselToolbarProps {
  measureMode: boolean;
  onMeasureModeToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom?: number;
  measurementCount?: number;
  showRuler?: boolean;
  onToggleRuler?: () => void;
}

export const CarouselToolbar = React.memo<CarouselToolbarProps>(
  function CarouselToolbar({
    measureMode,
    onMeasureModeToggle,
    onZoomIn,
    onZoomOut,
    onReset,
    zoom = 1,
    measurementCount = 0,
    onToggleRuler,
    showRuler = true,
  }) {
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <div className="bg-white rounded-lg p-2 shadow-lg border border-gray-200/50">
          <div className="flex items-center gap-3">
            {/* Measurement Mode Toggle */}
            <Button
              size="sm"
              variant={measureMode ? "default" : "outline"}
              onClick={onMeasureModeToggle}
              className={
                measureMode
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25 border-0"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
              }
            >
              <Ruler className="h-4 w-4 mr-2" />
              Measure
              {measurementCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-gray-700 text-white text-xs px-1.5 py-0.5"
                >
                  {measurementCount}
                </Badge>
              )}
            </Button>

            {/* Ruler Toggle */}
            {onToggleRuler && (
              <Button
                size="sm"
                variant={showRuler ? "default" : "outline"}
                onClick={onToggleRuler}
                className={
                  showRuler
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 border-0"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                }
                title="Toggle measurement ruler (R)"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            )}

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200"></div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <Button
                size="sm"
                variant="ghost"
                onClick={onZoomOut}
                disabled={zoom <= 0.5}
                className="text-gray-600 hover:bg-gray-100 rounded-none px-2 disabled:opacity-40"
                title="Zoom out (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <div className="flex items-center px-3 text-sm font-mono bg-white border-x border-gray-200 min-w-[70px] justify-center text-gray-700 h-8">
                {Math.round(zoom * 100)}%
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={onZoomIn}
                disabled={zoom >= 5}
                className="text-gray-600 hover:bg-gray-100 rounded-none px-2 disabled:opacity-40"
                title="Zoom in (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Reset Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
              title="Reset view and measurements (0)"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
