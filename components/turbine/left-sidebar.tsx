// app/components/turbine/left-sidebar.tsx
"use client";

import Image from "next/image";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TurbineImage, FilterState } from "@/types";
import { BladePositionTracker } from "@/components/turbine/blade-position-tracker";
import { getSideInfo, getBladeColorScheme } from "@/lib/blade-utils";

interface LeftSidebarProps {
  onFilterChange: (filter: FilterState) => void;
  currentFilter: FilterState;
  allImages: TurbineImage[];
  currentImageIndex: number;
  filteredImages?: TurbineImage[];
  onImageChange?: (index: number) => void;
}

export const LeftSidebar = React.memo<LeftSidebarProps>(function LeftSidebar({
  onFilterChange,
  currentFilter,
  allImages,
  currentImageIndex,
  filteredImages = [],
  onImageChange,
}) {
  const [imageCounts, setImageCounts] = React.useState<{
    byBlade: Record<"A" | "B" | "C", number>;
    bySide: Record<"TE" | "PS" | "LE" | "SS", number>;
    total: number;
  }>({
    byBlade: { A: 0, B: 0, C: 0 },
    bySide: { TE: 0, PS: 0, LE: 0, SS: 0 },
    total: 0,
  });

  // Calculate image counts from allImages
  React.useEffect(() => {
    const counts = {
      byBlade: { A: 0, B: 0, C: 0 },
      bySide: { TE: 0, PS: 0, LE: 0, SS: 0 },
      total: allImages.length,
    };

    allImages.forEach((img) => {
      if (img && img.blade && counts.byBlade.hasOwnProperty(img.blade)) {
        counts.byBlade[img.blade]++;
      }
      if (img && img.side && counts.bySide.hasOwnProperty(img.side)) {
        counts.bySide[img.side]++;
      }
    });

    setImageCounts(counts);
  }, [allImages]);

  const handleBladeChange = (blade: "A" | "B" | "C") => {
    onFilterChange({ ...currentFilter, blade });
  };

  const handleSideChange = (side: "TE" | "PS" | "LE" | "SS") => {
    onFilterChange({ ...currentFilter, side });
  };

  const getSideLabel = (side: "TE" | "PS" | "LE" | "SS") => {
    const sideInfo = getSideInfo(side);
    return sideInfo.fullName;
  };

  const currentBladeColor = getBladeColorScheme(currentFilter.blade);

  return (
    <SidebarProvider>
      <Sidebar className="w-80">
        <SidebarHeader className="p-4">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-base">
                Turbine Blade Selection
              </h3>
            </div>

            {/* Blade Selection */}
            <div className="space-y-3">
              <RadioGroup
                value={currentFilter.blade}
                onValueChange={handleBladeChange}
                className="flex justify-center space-x-6"
              >
                {(["A", "B", "C"] as const).map((blade) => {
                  const bladeColor = getBladeColorScheme(blade);
                  const count = imageCounts.byBlade[blade];

                  return (
                    <div
                      key={blade}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="relative">
                        <RadioGroupItem
                          value={blade}
                          id={`blade-${blade}`}
                          className="w-6 h-6"
                        />
                        {count === 0 && (
                          <div className="absolute inset-0 bg-gray-200 rounded-full opacity-50" />
                        )}
                      </div>
                      <Label
                        htmlFor={`blade-${blade}`}
                        className={`font-semibold text-lg cursor-pointer hover:opacity-80 transition-colors ${
                          count === 0 ? "opacity-50" : ""
                        }`}
                      >
                        <Badge
                          variant="outline"
                          className={`text-white px-3 text-sm font-medium ${bladeColor.solid} border-0`}
                        >
                          {blade}
                        </Badge>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          </div>
        </SidebarHeader>

        {/* Blade Position Tracker */}
        {onImageChange && (
          <BladePositionTracker
            images={filteredImages}
            currentImageIndex={currentImageIndex}
            currentFilter={currentFilter}
            onImageChange={onImageChange}
          />
        )}

        <SidebarFooter className="p-4 space-y-4">
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="text-sm font-medium">Blade Side View</h4>
            </div>

            <div className="relative flex justify-center items-center h-40 w-full">
              <div className="relative">
                {/* Blade diagram */}
                <Image
                  width={80}
                  height={80}
                  src="/turbine-blade-side.png"
                  alt="turbine blade side view"
                  className="opacity-70"
                />

                {/* Side position indicators */}
                {(["TE", "PS", "LE", "SS"] as const).map((side) => {
                  const positions = {
                    TE: {
                      bottom: "-3px",
                      left: "25%",
                      right: "25%",
                      height: "10px",
                    },
                    PS: {
                      top: "-3px",
                      left: "25%",
                      right: "25%",
                      height: "10px",
                    },
                    LE: {
                      top: "25%",
                      bottom: "25%",
                      right: "-3px",
                      width: "10px",
                    },
                    SS: {
                      top: "25%",
                      bottom: "25%",
                      left: "-3px",
                      width: "10px",
                    },
                  };

                  const isSelected = currentFilter.side === side;
                  const sideInfo = getSideInfo(side);

                  return (
                    <div
                      key={side}
                      className={`absolute transition-all duration-300 ${
                        isSelected
                          ? `${sideInfo.color.replace(
                              "100",
                              "500"
                            )} opacity-100 border-2`
                          : "border-2 border-gray-300 bg-gray-200/50 opacity-60"
                      }`}
                      style={positions[side]}
                      title={sideInfo.fullName}
                    />
                  );
                })}
              </div>

              {/* Side selection buttons */}
              <Button
                variant={currentFilter.side === "TE" ? "default" : "outline"}
                size="sm"
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-8 text-xs"
                onClick={() => handleSideChange("TE")}
                disabled={imageCounts.bySide.TE === 0}
              >
                TE
              </Button>

              <Button
                variant={currentFilter.side === "PS" ? "default" : "outline"}
                size="sm"
                className="absolute top-0 left-1/2 transform -translate-x-1/2 h-8 text-xs"
                onClick={() => handleSideChange("PS")}
                disabled={imageCounts.bySide.PS === 0}
              >
                PS
              </Button>

              <Button
                variant={currentFilter.side === "LE" ? "default" : "outline"}
                size="sm"
                className="absolute top-1/2 right-6 transform -translate-y-1/2 h-8 text-xs"
                onClick={() => handleSideChange("LE")}
                disabled={imageCounts.bySide.LE === 0}
              >
                LE
              </Button>

              <Button
                variant={currentFilter.side === "SS" ? "default" : "outline"}
                size="sm"
                className="absolute top-1/2 left-6 transform -translate-y-1/2 h-8 text-xs"
                onClick={() => handleSideChange("SS")}
                disabled={imageCounts.bySide.SS === 0}
              >
                SS
              </Button>
            </div>

            {/* Current selection info */}
            <div className="text-center">
              <div className="text-xs text-gray-500">
                <div className="font-medium">
                  {getSideLabel(currentFilter.side)}
                </div>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
});
