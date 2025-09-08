// app/components/turbine/cursor-ruler-overlay.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TurbineImage } from "@/types";

interface CursorRulerOverlayProps {
  image: TurbineImage;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  allImages?: TurbineImage[];
  currentFilter?: {
    blade: "A" | "B" | "C";
    side: "TE" | "PS" | "LE" | "SS";
  };
}

export const CursorRulerOverlay = React.memo<CursorRulerOverlayProps>(
  function CursorRulerOverlay({
    image,
    zoom,
    pan,
    containerRef,
    allImages = [],
    currentFilter,
  }) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [containerBounds, setContainerBounds] = useState({
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    });
    const [imageBounds, setImageBounds] = useState({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
    const [isMouseOverImage, setIsMouseOverImage] = useState(false);

    // Calculate blade context for absolute positioning
    const bladeContext = useMemo(() => {
      if (!allImages.length || !currentFilter) return null;

      const filteredImages = allImages.filter(
        (img) =>
          img.blade === currentFilter.blade && img.side === currentFilter.side
      );

      const altitudes = filteredImages
        .map((img) => img.gsd?.flight_height || 0)
        .filter((alt) => alt > 0)
        .sort((a, b) => a - b);

      if (altitudes.length === 0) return null;

      const minAltitude = altitudes[0];
      const maxAltitude = altitudes[altitudes.length - 1];
      const currentAltitude = image.gsd?.flight_height || minAltitude;

      return {
        minAltitude,
        maxAltitude,
        currentAltitude,
        bladeLength: maxAltitude - minAltitude,
      };
    }, [allImages, currentFilter, image]);

    const rulerData = useMemo(() => {
      const gsdCmPerPixel = image?.gsd?.gsd_cm_per_pixel || 0;

      if (gsdCmPerPixel <= 0) {
        return null;
      }

      // Effective GSD considering zoom level
      const effectiveGsdCmPerPixel = gsdCmPerPixel / zoom;

      // Adaptive ruler intervals based on zoom level
      let rulerIntervalCm: number;
      let majorIntervalCm: number;
      let minorIntervalCm: number;

      if (zoom < 0.8) {
        rulerIntervalCm = 100;
        majorIntervalCm = 500;
        minorIntervalCm = 50;
      } else if (zoom < 1.5) {
        rulerIntervalCm = 50;
        majorIntervalCm = 200;
        minorIntervalCm = 25;
      } else if (zoom < 2.5) {
        rulerIntervalCm = 20;
        majorIntervalCm = 100;
        minorIntervalCm = 10;
      } else if (zoom < 4) {
        rulerIntervalCm = 10;
        majorIntervalCm = 50;
        minorIntervalCm = 5;
      } else {
        rulerIntervalCm = 5;
        majorIntervalCm = 20;
        minorIntervalCm = 2;
      }

      const rulerIntervalPx = rulerIntervalCm / effectiveGsdCmPerPixel;
      const minorIntervalPx = minorIntervalCm / effectiveGsdCmPerPixel;

      return {
        effectiveGsdCmPerPixel,
        rulerIntervalCm,
        majorIntervalCm,
        minorIntervalCm,
        rulerIntervalPx,
        minorIntervalPx,
      };
    }, [image?.gsd?.gsd_cm_per_pixel, zoom]);

    // Update container and image bounds
    useEffect(() => {
      const updateBounds = () => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        setContainerBounds({
          width: containerRect.width,
          height: containerRect.height,
          left: containerRect.left,
          top: containerRect.top,
        });

        // Calculate image bounds within container
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        const scaleX = containerWidth / image.width;
        const scaleY = containerHeight / image.height;
        const fitScale = Math.min(scaleX, scaleY, 1);

        const imageDisplayWidth = image.width * fitScale * zoom;
        const imageDisplayHeight = image.height * fitScale * zoom;

        const imageCenterX = containerWidth / 2 + pan.x;
        const imageCenterY = containerHeight / 2 + pan.y;

        const imageLeft = imageCenterX - imageDisplayWidth / 2;
        const imageTop = imageCenterY - imageDisplayHeight / 2;

        setImageBounds({
          left: imageLeft,
          top: imageTop,
          width: imageDisplayWidth,
          height: imageDisplayHeight,
        });
      };

      updateBounds();
      const resizeObserver = new ResizeObserver(updateBounds);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => resizeObserver.disconnect();
    }, [containerRef, image.width, image.height, zoom, pan]);

    // Track mouse position
    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setMousePos({ x, y });

        // Check if mouse is over image
        const overImage =
          x >= imageBounds.left &&
          x <= imageBounds.left + imageBounds.width &&
          y >= imageBounds.top &&
          y <= imageBounds.top + imageBounds.height;

        setIsMouseOverImage(overImage);
      },
      [containerRef, imageBounds]
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () =>
        setIsMouseOverImage(false)
      );

      return () => {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", () =>
          setIsMouseOverImage(false)
        );
      };
    }, [handleMouseMove]);

    const formatDistance = useCallback((distanceCm: number) => {
      if (distanceCm >= 100) {
        return `${(distanceCm / 100).toFixed(distanceCm % 100 === 0 ? 0 : 1)}m`;
      }
      return `${distanceCm.toFixed(0)}cm`;
    }, []);

    // Generate ruler marks only for visible area
    const generateRulerMarks = useCallback(
      (isHorizontal: boolean) => {
        if (!rulerData) return [];

        const marks = [];
        const {
          rulerIntervalPx,
          rulerIntervalCm,
          majorIntervalCm,
          minorIntervalPx,
          minorIntervalCm,
        } = rulerData;

        // Calculate visible area
        const visibleStart = isHorizontal
          ? Math.max(0, -imageBounds.left)
          : Math.max(0, -imageBounds.top);
        const visibleEnd = isHorizontal
          ? Math.min(
              containerBounds.width,
              imageBounds.left + imageBounds.width
            )
          : Math.min(
              containerBounds.height,
              imageBounds.top + imageBounds.height
            );

        const visibleLength = visibleEnd - visibleStart;

        // Only show ruler if we have reasonable zoom level
        if (zoom < 0.5 || visibleLength < 50) return [];

        // Calculate mark positions
        const startOffset = isHorizontal ? imageBounds.left : imageBounds.top;
        const maxMarks = Math.min(
          50,
          Math.ceil(visibleLength / Math.min(rulerIntervalPx, minorIntervalPx))
        );

        for (let i = 0; i <= maxMarks; i++) {
          const majorPosition = i * rulerIntervalPx;
          const minorPosition = i * minorIntervalPx;

          // Add major marks
          if (
            majorPosition <= visibleLength &&
            startOffset + majorPosition >= 0
          ) {
            const realWorldDistance = i * rulerIntervalCm;
            const isMajor = realWorldDistance % majorIntervalCm === 0;

            marks.push({
              position: majorPosition,
              isMajor: true,
              label:
                isMajor && realWorldDistance > 0
                  ? formatDistance(realWorldDistance)
                  : "",
              realWorldDistance,
              type: "major",
            });
          }

          // Add minor marks if zoom is high enough
          if (
            zoom > 1.5 &&
            minorPosition <= visibleLength &&
            startOffset + minorPosition >= 0
          ) {
            marks.push({
              position: minorPosition,
              isMajor: false,
              label: "",
              realWorldDistance: i * minorIntervalCm,
              type: "minor",
            });
          }
        }

        return marks;
      },
      [rulerData, imageBounds, containerBounds, zoom, formatDistance]
    );

    if (!rulerData || !isMouseOverImage) {
      return null;
    }

    const horizontalMarks = generateRulerMarks(true);
    const verticalMarks = generateRulerMarks(false);

    // Calculate mouse position in image coordinates
    const mouseImageX =
      (mousePos.x - imageBounds.left) * rulerData.effectiveGsdCmPerPixel;
    const mouseImageY =
      (mousePos.y - imageBounds.top) * rulerData.effectiveGsdCmPerPixel;

    // Calculate absolute position on blade
    const absolutePosition = bladeContext
      ? {
          altitude: bladeContext.currentAltitude,
          relativeHeight: mouseImageY,
          absoluteHeight: bladeContext.currentAltitude + mouseImageY / 100, // Convert cm to m
          bladePercentage:
            ((bladeContext.currentAltitude - bladeContext.minAltitude) /
              bladeContext.bladeLength) *
            100,
        }
      : null;

    const rulerOpacity = zoom > 2 ? 0.9 : 0.7;
    const rulerSize = Math.max(0.8, Math.min(1.2, zoom));

    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Crosshair lines */}
        <div
          className="absolute w-px bg-red-500/60 shadow-sm z-30"
          style={{
            left: mousePos.x,
            top: Math.max(0, imageBounds.top),
            height: Math.min(containerBounds.height, imageBounds.height),
            opacity: rulerOpacity,
          }}
        />
        <div
          className="absolute h-px bg-red-500/60 shadow-sm z-30"
          style={{
            left: Math.max(0, imageBounds.left),
            top: mousePos.y,
            width: Math.min(containerBounds.width, imageBounds.width),
            opacity: rulerOpacity,
          }}
        />

        {/* Horizontal ruler - only show if image is wide enough */}
        {imageBounds.width > 100 && zoom > 0.8 && (
          <div
            className="absolute border-b border-gray-400/80 bg-white/90 shadow-lg z-25"
            style={{
              left: Math.max(0, imageBounds.left),
              top: Math.max(0, imageBounds.top - 25 * rulerSize),
              width: Math.min(
                containerBounds.width - Math.max(0, imageBounds.left),
                imageBounds.width
              ),
              height: 25 * rulerSize,
              fontSize: `${10 * rulerSize}px`,
            }}
          >
            <svg className="w-full h-full overflow-visible">
              {horizontalMarks.map((mark, index) => (
                <g key={`h-${index}`}>
                  <line
                    x1={mark.position}
                    y1={mark.isMajor ? 5 * rulerSize : 12 * rulerSize}
                    x2={mark.position}
                    y2={25 * rulerSize}
                    stroke="#374151"
                    strokeWidth={mark.isMajor ? 2 : 1}
                  />
                  {mark.label && (
                    <text
                      x={mark.position}
                      y={15 * rulerSize}
                      fill="#374151"
                      fontSize={`${10 * rulerSize}px`}
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="600"
                    >
                      {mark.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Vertical ruler - only show if image is tall enough */}
        {imageBounds.height > 100 && zoom > 0.8 && (
          <div
            className="absolute border-r border-gray-400/80 bg-white/90 shadow-lg z-25"
            style={{
              left: Math.max(0, imageBounds.left - 40 * rulerSize),
              top: Math.max(0, imageBounds.top),
              width: 40 * rulerSize,
              height: Math.min(
                containerBounds.height - Math.max(0, imageBounds.top),
                imageBounds.height
              ),
              fontSize: `${10 * rulerSize}px`,
            }}
          >
            <svg className="w-full h-full overflow-visible">
              {verticalMarks.map((mark, index) => (
                <g key={`v-${index}`}>
                  <line
                    x1={mark.isMajor ? 15 * rulerSize : 25 * rulerSize}
                    y1={mark.position}
                    x2={40 * rulerSize}
                    y2={mark.position}
                    stroke="#374151"
                    strokeWidth={mark.isMajor ? 2 : 1}
                  />
                  {mark.label && (
                    <text
                      x={30 * rulerSize}
                      y={mark.position + 3 * rulerSize}
                      fill="#374151"
                      fontSize={`${10 * rulerSize}px`}
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="600"
                      transform={`rotate(-90 ${30 * rulerSize} ${
                        mark.position + 3 * rulerSize
                      })`}
                    >
                      {mark.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Enhanced position indicator */}
        <div
          className="absolute bg-gradient-to-br from-red-600 to-red-700 text-white px-3 py-2 rounded-lg shadow-xl pointer-events-none z-40 font-mono text-sm border border-red-400/50"
          style={{
            left: mousePos.x + 20,
            top: mousePos.y - 80,
            transform:
              mousePos.x > containerBounds.width - 200
                ? "translateX(-100%)"
                : "",
            minWidth: "180px",
          }}
        >
          <div className="space-y-1">
            {/* Image coordinates */}
            <div className="text-xs opacity-90">
              Image: {mouseImageX.toFixed(1)}cm, {mouseImageY.toFixed(1)}cm
            </div>

            {/* Absolute position if available */}
            {absolutePosition && (
              <>
                <div className="border-t border-red-400/30 pt-1">
                  <div className="text-xs font-semibold">
                    Altitude: {absolutePosition.absoluteHeight.toFixed(2)}m
                  </div>
                  <div className="text-xs opacity-90">
                    Base: {absolutePosition.altitude.toFixed(1)}m +{" "}
                    {(absolutePosition.relativeHeight / 100).toFixed(2)}m
                  </div>
                </div>
                <div className="text-xs opacity-90">
                  Blade: {absolutePosition.bladePercentage.toFixed(1)}%
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scale and zoom info */}
        <div
          className="absolute text-gray-700 bg-white/95 p-3 rounded-lg shadow-lg border text-xs z-25"
          style={{
            right: 20,
            bottom: 20,
            minWidth: "160px",
          }}
        >
          <div className="space-y-1">
            <div className="font-semibold text-sm">Scale Info</div>
            <div className="font-mono">
              {rulerData.effectiveGsdCmPerPixel.toFixed(3)} cm/px
            </div>
            <div className="text-gray-500 font-mono">
              Base: {image.gsd.gsd_cm_per_pixel.toFixed(4)} cm/px
            </div>
            <div className="text-gray-500">
              Zoom: {(zoom * 100).toFixed(0)}%
            </div>
            {bladeContext && (
              <div className="text-blue-600 pt-1 border-t">
                Blade: {bladeContext.bladeLength.toFixed(1)}m
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default CursorRulerOverlay;
