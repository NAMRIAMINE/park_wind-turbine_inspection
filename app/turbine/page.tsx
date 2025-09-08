// app/turbine/page.tsx
"use client";

import React, { useCallback, useState } from "react";
import { LoadingScreen } from "@/components/turbine/loading-screen";
import { ErrorScreen } from "@/components/turbine/error-screen";
import { LeftSidebar } from "@/components/turbine/left-sidebar";
import { TurbineCarousel } from "@/components/turbine/carousel";
import { RightSidebar } from "@/components/turbine/right-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Info,
  BarChart3,
  Download,
  Upload,
} from "lucide-react";
import { useEnhancedTurbine } from "@/hooks/use-enhanced-turbine";
import { validateTurbineImages } from "@/lib/image-validation";

export default function TurbinePage() {
  const {
    // Core state
    allImages,
    currentFilter,
    currentImageIndex,
    currentImage,
    filteredImages,
    viewState,
    settings,
    measurements,
    bladeContext,
    statistics,
    isLoading,
    error,
    containerRef,

    // Navigation
    navigateToImage,
    goToPrevious,
    goToNext,
    navigateToBladePosition,
    handleFilterChange,

    // View controls
    handleZoom,
    setZoom,
    handlePan,
    resetView,
    updateViewState,

    // Measurement controls
    updateMeasurements,
    clearAllMeasurements,
    exportAllMeasurements,

    // Settings
    updateSettings,

    // Utilities
    refreshData,
    getPerformanceMetrics,
  } = useEnhancedTurbine();

  // Local state for UI
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Validate images for measurement readiness
  const validationResult = React.useMemo(() => {
    return validateTurbineImages(allImages);
  }, [allImages]);

  // Enhanced image change handler
  const handleImageChange = useCallback(
    (index: number) => {
      navigateToImage(index);
    },
    [navigateToImage]
  );

  // Enhanced filter change handler
  const handleEnhancedFilterChange = useCallback(
    (newFilter: typeof currentFilter) => {
      handleFilterChange(newFilter);
    },
    [handleFilterChange]
  );

  // Export measurements handler
  const handleExportMeasurements = useCallback(
    (format: "csv" | "json" = "csv") => {
      const data = exportAllMeasurements(format);
      const blob = new Blob([data], {
        type: format === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `turbine-measurements-${currentFilter.blade}-${currentFilter.side}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [exportAllMeasurements, currentFilter]
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields or if keyboard shortcuts are disabled
      if (
        !settings.keyboardShortcuts ||
        (e.target && (e.target as HTMLElement).tagName === "INPUT")
      )
        return;

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
        case "f":
        case "F":
          e.preventDefault();
          updateViewState({ fullscreen: !viewState.fullscreen });
          break;
        case "s":
        case "S":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleExportMeasurements("csv");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    settings.keyboardShortcuts,
    goToPrevious,
    goToNext,
    viewState.fullscreen,
    updateViewState,
    handleExportMeasurements,
  ]);

  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return <ErrorScreen error={error} onRetry={refreshData} />;
  }

  // No images state
  if (allImages.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No turbine images found
          </h2>
          <p className="text-gray-600 mb-4">
            Upload some turbine blade images to get started with inspection and
            measurement.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => (window.location.href = "/upload")}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Images
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Validation warnings
  const showValidationWarning =
    !validationResult.isValid && allImages.length > 0;

  return (
    <div
      className={`${
        viewState.fullscreen ? "fixed inset-0 z-50" : "flex h-screen"
      } w-full`}
    >
      {/* Validation Warning Banner */}
      {showValidationWarning && !viewState.fullscreen && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-100 border-b border-yellow-200 p-2">
          <div className="flex items-center justify-between text-sm text-yellow-800">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <span>
                {validationResult.errors.length} measurement issues detected -
                {validationResult.statistics.validForMeasurement}/
                {validationResult.statistics.totalImages} images ready
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-yellow-700 hover:text-yellow-900"
              onClick={() => setShowValidationDetails(!showValidationDetails)}
            >
              {showValidationDetails ? "Hide" : "Details"}
            </Button>
          </div>
          {showValidationDetails && (
            <div className="mt-2 p-2 bg-yellow-50 rounded border text-xs text-yellow-700">
              <div className="grid grid-cols-2 gap-4">
                {validationResult.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {validationResult.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.suggestions.length > 0 && (
                  <div>
                    <strong>Suggestions:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {validationResult.suggestions
                        .slice(0, 3)
                        .map((suggestion, i) => (
                          <li key={i}>{suggestion}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Left Sidebar */}
      <div
        className={`${
          leftSidebarCollapsed ? "w-12" : "w-80"
        } flex-shrink-0 transition-all duration-300 ${
          viewState.fullscreen ? "hidden" : ""
        }`}
      >
        {leftSidebarCollapsed ? (
          <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftSidebarCollapsed(false)}
              className="mb-4"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex flex-col gap-2">
              {(["A", "B", "C"] as const).map((blade) => (
                <Button
                  key={blade}
                  variant={
                    currentFilter.blade === blade ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    handleEnhancedFilterChange({ ...currentFilter, blade })
                  }
                  className="w-8 h-8 p-0 text-xs"
                  title={`Blade ${blade}`}
                >
                  {blade}
                </Button>
              ))}
            </div>
            {statistics.totalMeasurements > 0 && (
              <div className="mt-4">
                <Badge variant="secondary" className="text-xs">
                  {statistics.totalMeasurements}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full bg-white border-r border-gray-200 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftSidebarCollapsed(true)}
              className="absolute top-4 right-2 z-10"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-4 p-4">
              <LeftSidebar
                onFilterChange={handleEnhancedFilterChange}
                currentFilter={currentFilter}
                allImages={allImages}
                currentImageIndex={currentImageIndex}
                filteredImages={filteredImages}
                onImageChange={handleImageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 relative" ref={containerRef}>
        {/* Top Control Bar */}
        <div className="absolute top-16 right-4 z-40 flex items-center gap-2">
          {/* Export Button */}
          {statistics.totalMeasurements > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleExportMeasurements("csv")}
              className="bg-white/90 hover:bg-white shadow-lg"
              title="Export measurements (Ctrl+S)"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}

          {/* Settings Button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => console.log("Open settings")}
            className="bg-white/90 hover:bg-white shadow-lg"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              updateViewState({ fullscreen: !viewState.fullscreen })
            }
            className="bg-white/90 hover:bg-white shadow-lg"
            title={
              viewState.fullscreen
                ? "Exit fullscreen (F)"
                : "Enter fullscreen (F)"
            }
          >
            {viewState.fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {filteredImages.length > 0 ? (
          <TurbineCarousel
            images={filteredImages}
            currentImageIndex={currentImageIndex}
            onImageChange={handleImageChange}
            allImages={allImages}
            currentFilter={currentFilter}
            viewState={viewState}
            onViewStateChange={updateViewState}
            onZoom={handleZoom}
            onSetZoom={setZoom}
            onPan={handlePan}
            onResetView={resetView}
            measurements={measurements}
            onUpdateMeasurements={updateMeasurements}
            bladeContext={bladeContext}
            settings={settings}
          />
        ) : (
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No images found for Blade {currentFilter.blade} -{" "}
                {currentFilter.side}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Try selecting a different blade or side, or upload more images
              </p>
              <div className="flex justify-center gap-2 mb-4">
                {(["A", "B", "C"] as const).map((blade) => (
                  <Button
                    key={blade}
                    variant={
                      currentFilter.blade === blade ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      handleEnhancedFilterChange({ ...currentFilter, blade })
                    }
                  >
                    Blade {blade}
                  </Button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                {(["TE", "PS", "LE", "SS"] as const).map((side) => (
                  <Button
                    key={side}
                    variant={
                      currentFilter.side === side ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      handleEnhancedFilterChange({ ...currentFilter, side })
                    }
                  >
                    {side}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div
        className={`${
          rightSidebarCollapsed ? "w-12" : "w-80"
        } flex-shrink-0 transition-all duration-300 ${
          viewState.fullscreen ? "hidden" : ""
        }`}
      >
        {rightSidebarCollapsed ? (
          <div className="h-full border-l border-gray-200 flex flex-col items-center py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarCollapsed(false)}
              className="mb-4"
              title="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs text-gray-500 text-center space-y-2">
              <div className="font-medium">
                {currentImageIndex + 1}/{filteredImages.length}
              </div>
              <div className="transform rotate-90 whitespace-nowrap">
                {currentFilter.blade}-{currentFilter.side}
              </div>
              {statistics.currentImageMeasurements > 0 && (
                <div
                  className="w-2 h-2 bg-green-500 rounded-full mx-auto"
                  title={`${statistics.currentImageMeasurements} measurements`}
                />
              )}
              {bladeContext && (
                <div className="text-xs text-blue-600">
                  {bladeContext.currentImagePosition?.percentageFromBase.toFixed(
                    0
                  )}
                  %
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full border-l border-gray-500 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarCollapsed(true)}
              className="absolute top-4 left-2 z-10"
              title="Collapse sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <RightSidebar
              selectedImage={currentImage}
              imageIndex={currentImageIndex}
              totalImages={filteredImages.length}
              currentFilter={currentFilter}
              measurements={measurements[currentImage?.id || ""] || []}
              statistics={statistics}
              bladeContext={bladeContext || undefined}
              onClearMeasurements={() =>
                currentImage && updateMeasurements(currentImage.id, [])
              }
              validationResult={validationResult}
            />
          </div>
        )}
      </div>

      {/* Global navigation overlay for fullscreen */}
      {viewState.fullscreen && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-4 transform -translate-y-1/2 pointer-events-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentImageIndex === 0}
              className="bg-white/90 hover:bg-white shadow-lg"
              title="Previous image (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 pointer-events-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentImageIndex === filteredImages.length - 1}
              className="bg-white/90 hover:bg-white shadow-lg"
              title="Next image (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Fullscreen info overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
              <div className="text-center">
                <div className="font-medium">
                  {currentImage?.name || "Unknown Image"}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  Blade {currentFilter.blade} - {currentFilter.side} • Image{" "}
                  {currentImageIndex + 1} of {filteredImages.length}
                  {statistics.currentImageMeasurements > 0 &&
                    ` • ${statistics.currentImageMeasurements} measurements`}
                  {bladeContext?.currentImagePosition &&
                    ` • ${bladeContext.currentImagePosition.percentageFromBase.toFixed(
                      0
                    )}% up blade`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
