"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  TurbineImage,
  FilterState,
  Measurement,
  Statistics,
  BladeContext,
  ValidationResult,
} from "@/types";
import {
  Camera,
  Ruler,
  MapPin,
  BarChart3,
  Trash2,
  Download,
  Info,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
} from "lucide-react";
import {
  getSideInfo,
  getBladeColorScheme,
  formatDistanceForRuler,
} from "@/lib/blade-utils";
import { formatDate } from "@/lib/utils";

interface RightSidebarProps {
  selectedImage?: TurbineImage;
  imageIndex: number;
  totalImages: number;
  currentFilter: FilterState;
  measurements?: Measurement[];
  statistics?: Statistics;
  bladeContext?: BladeContext;
  onClearMeasurements?: () => void;
  validationResult?: ValidationResult;
}

export const RightSidebar = React.memo<RightSidebarProps>(
  function RightSidebar({
    selectedImage,
    imageIndex,
    totalImages,
    currentFilter,
    measurements = [],
    statistics,
    bladeContext,
    onClearMeasurements,
    validationResult,
  }) {
    const sideInfo = getSideInfo(currentFilter.side);
    const bladeColor = getBladeColorScheme(currentFilter.blade);

    const getConfidenceColor = (confidence: "high" | "medium" | "low") => {
      switch (confidence) {
        case "high":
          return "text-green-600 bg-green-100";
        case "medium":
          return "text-yellow-600 bg-yellow-100";
        case "low":
          return "text-red-600 bg-red-100";
        default:
          return "text-gray-600 bg-gray-100";
      }
    };

    const getConfidenceIcon = (confidence: "high" | "medium" | "low") => {
      switch (confidence) {
        case "high":
          return <CheckCircle className="h-3 w-3" />;
        case "medium":
          return <Info className="h-3 w-3" />;
        case "low":
          return <AlertTriangle className="h-3 w-3" />;
        default:
          return <Info className="h-3 w-3" />;
      }
    };

    if (!selectedImage) {
      return (
        <div className="p-4 space-y-4">
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-gray-500">No image selected</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        {/* Image Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Image Details</CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={bladeColor.solid}>
                  {currentFilter.blade}
                </Badge>
                <Badge variant="outline" className={sideInfo.color}>
                  {currentFilter.side}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium text-gray-700 mb-1">
                {selectedImage.name}
              </div>
              <div className="text-xs text-gray-500">
                Image {imageIndex + 1} of {totalImages}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4 text-gray-400" />
              <span>
                {selectedImage.camera.make} {selectedImage.camera.model}
              </span>
            </div>

            <div className="text-xs text-gray-500">
              <div>
                Resolution: {selectedImage.width} × {selectedImage.height}
              </div>
              <div>Date: {formatDate(selectedImage.date)}</div>
            </div>
          </CardContent>
        </Card>

        {/* GSD & Distance Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Measurement Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedImage.gsd ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      GSD (Resolution)
                    </span>
                    <Badge
                      variant="outline"
                      className={getConfidenceColor(
                        selectedImage.gsd.distance_confidence
                      )}
                    >
                      {getConfidenceIcon(selectedImage.gsd.distance_confidence)}
                      <span className="ml-1">
                        {selectedImage.gsd.distance_confidence}
                      </span>
                    </Badge>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-600">
                    {selectedImage.gsd.gsd_cm_per_pixel.toFixed(4)} cm/pixel
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Distance to Blade</div>
                    <div className="font-medium">
                      {selectedImage.gsd.distance_to_blade.toFixed(2)}m
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Flight Height</div>
                    <div className="font-medium">
                      {selectedImage.gsd.flight_height.toFixed(1)}m
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <div>Source: {selectedImage.gsd.distance_source}</div>
                  <div>Altitude: {selectedImage.gsd.altitude_source}</div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-4">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <div className="text-sm">No GSD data available</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blade Position */}
        {bladeContext && bladeContext.currentImagePosition && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Blade Position
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Position on Blade</span>
                  <span className="text-lg font-bold text-blue-600">
                    {bladeContext.currentImagePosition.percentageFromBase.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={bladeContext.currentImagePosition.percentageFromBase}
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Altitude</div>
                  <div className="font-medium">
                    {bladeContext.currentAltitude.toFixed(1)}m
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">From Base</div>
                  <div className="font-medium">
                    {bladeContext.currentImagePosition.altitudeFromBase.toFixed(
                      1
                    )}
                    m
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                <div>Blade length: {bladeContext.lengthMeters.toFixed(1)}m</div>
                <div>Total images: {bladeContext.totalImages}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Measurements */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Measurements
              </CardTitle>
              {measurements.length > 0 && onClearMeasurements && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearMeasurements}
                  className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {measurements.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  {measurements.length} measurement
                  {measurements.length !== 1 ? "s" : ""}
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {measurements.map((measurement, index) => (
                    <div
                      key={measurement.id}
                      className="border rounded p-2 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">#{index + 1}</span>
                        <span className="text-blue-600 font-mono">
                          {formatDistanceForRuler(measurement.distance)}
                        </span>
                      </div>

                      {measurement.absolutePosition && (
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>
                            Altitude:{" "}
                            {measurement.absolutePosition.altitude.toFixed(2)}m
                          </div>
                          <div>
                            Blade:{" "}
                            {measurement.absolutePosition.bladePercentage.toFixed(
                              1
                            )}
                            %
                          </div>
                        </div>
                      )}

                      {measurement.createdAt && (
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(measurement.createdAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Measurement Statistics */}
                <Separator />
                <div className="text-xs text-gray-500">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div>Total length:</div>
                      <div className="font-medium">
                        {formatDistanceForRuler(
                          measurements.reduce((sum, m) => sum + m.distance, 0)
                        )}
                      </div>
                    </div>
                    <div>
                      <div>Average:</div>
                      <div className="font-medium">
                        {formatDistanceForRuler(
                          measurements.reduce((sum, m) => sum + m.distance, 0) /
                            measurements.length
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-6">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No measurements yet</div>
                <div className="text-xs mt-1">Press M to start measuring</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        {statistics && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Session Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Total Images</div>
                  <div className="font-medium">{statistics.totalImages}</div>
                </div>
                <div>
                  <div className="text-gray-500">Measurements</div>
                  <div className="font-medium">
                    {statistics.totalMeasurements}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Blade Length</div>
                  <div className="font-medium">
                    {statistics.bladeLength.toFixed(1)}m
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Progress</div>
                  <div className="font-medium">
                    {statistics.currentProgress.toFixed(0)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Status */}
        {validationResult && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                Quality Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Ready for Measurement</span>
                  <Badge
                    variant={validationResult.isValid ? "default" : "secondary"}
                    className={
                      validationResult.isValid
                        ? "bg-green-600"
                        : "bg-yellow-600"
                    }
                  >
                    {validationResult.statistics.validForMeasurement}/
                    {validationResult.statistics.totalImages}
                  </Badge>
                </div>

                <Progress
                  value={
                    (validationResult.statistics.validForMeasurement /
                      validationResult.statistics.totalImages) *
                    100
                  }
                  className="h-2"
                />
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  High confidence:{" "}
                  {validationResult.statistics.highConfidenceDistance}
                </div>
                <div>
                  Medium confidence:{" "}
                  {validationResult.statistics.mediumConfidenceDistance}
                </div>
                <div>
                  Low confidence:{" "}
                  {validationResult.statistics.lowConfidenceDistance}
                </div>
              </div>

              {(validationResult.errors.length > 0 ||
                validationResult.warnings.length > 0) && (
                <div className="text-xs">
                  {validationResult.errors.length > 0 && (
                    <div className="text-red-600 mb-1">
                      {validationResult.errors.length} error
                      {validationResult.errors.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {validationResult.warnings.length > 0 && (
                    <div className="text-yellow-600">
                      {validationResult.warnings.length} warning
                      {validationResult.warnings.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Actions */}
        {measurements.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => console.log("Export CSV")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Measurements (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => console.log("Export JSON")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data (JSON)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);
