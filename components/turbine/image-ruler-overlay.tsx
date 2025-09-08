// app/components/turbine/image-ruler-overlay.tsx
import React, { useMemo, useState, useCallback } from "react";
import { TurbineImage } from "@/types";

interface ImageRulerOverlayProps {
  image: TurbineImage;
  zoom: number;
  pan: { x: number; y: number };
  isVisible: boolean;
}

export const ImageRulerOverlay = React.memo<ImageRulerOverlayProps>(
  function ImageRulerOverlay({ image, zoom, pan, isVisible = true }) {
    const [showRuler, setShowRuler] = useState(isVisible);

    const rulerData = useMemo(() => {
      const gsdCmPerPixel = image?.gsd?.gsd_cm_per_pixel || 0;

      if (gsdCmPerPixel <= 0 || !showRuler) {
        return null;
      }

      // Effective GSD considering zoom level only
      const effectiveGsdCmPerPixel = gsdCmPerPixel / zoom;

      // Determine appropriate ruler intervals based on current scale
      let rulerIntervalCm: number;
      let majorIntervalCm: number;

      if (effectiveGsdCmPerPixel > 50) {
        rulerIntervalCm = 100; // 1m
        majorIntervalCm = 500; // 5m
      } else if (effectiveGsdCmPerPixel > 20) {
        rulerIntervalCm = 50; // 50cm
        majorIntervalCm = 200; // 2m
      } else if (effectiveGsdCmPerPixel > 10) {
        rulerIntervalCm = 20; // 20cm
        majorIntervalCm = 100; // 1m
      } else if (effectiveGsdCmPerPixel > 5) {
        rulerIntervalCm = 10; // 10cm
        majorIntervalCm = 50; // 50cm
      } else if (effectiveGsdCmPerPixel > 1) {
        rulerIntervalCm = 5; // 5cm
        majorIntervalCm = 20; // 20cm
      } else {
        rulerIntervalCm = 1; // 1cm
        majorIntervalCm = 10; // 10cm
      }

      // Convert intervals to pixels
      const rulerIntervalPx = rulerIntervalCm / effectiveGsdCmPerPixel;

      return {
        effectiveGsdCmPerPixel,
        rulerIntervalCm,
        majorIntervalCm,
        rulerIntervalPx,
      };
    }, [image?.gsd?.gsd_cm_per_pixel, zoom, showRuler]);

    const formatDistance = useCallback((distanceCm: number) => {
      if (distanceCm >= 100) {
        return `${(distanceCm / 100).toFixed(distanceCm % 100 === 0 ? 0 : 1)}m`;
      }
      return `${distanceCm}cm`;
    }, []);

    const generateRulerMarks = useCallback(
      (isHorizontal: boolean, maxLength: number) => {
        if (!rulerData) return [];

        const marks = [];
        const { rulerIntervalPx, rulerIntervalCm, majorIntervalCm } = rulerData;

        // Calculate how many marks we can fit (limit for performance)
        const maxMarks = Math.min(30, Math.floor(maxLength / rulerIntervalPx));

        for (let i = 0; i <= maxMarks; i++) {
          const position = i * rulerIntervalPx;
          if (position > maxLength) break;

          const realWorldDistance = i * rulerIntervalCm;
          const isMajor = realWorldDistance % majorIntervalCm === 0;

          marks.push({
            position,
            isMajor,
            label: isMajor ? formatDistance(realWorldDistance) : "",
            realWorldDistance,
          });
        }

        return marks;
      },
      [rulerData, formatDistance]
    );

    if (!rulerData || !showRuler || !isVisible) {
      return null;
    }

    // Fixed dimensions for viewport
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 800;

    const horizontalMarks = generateRulerMarks(true, viewportWidth);
    const verticalMarks = generateRulerMarks(false, viewportHeight - 40);

    return (
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Top horizontal ruler */}
        <div className="absolute top-0 left-0 right-0 h-10">
          <svg className="w-full h-full">
            {horizontalMarks.map((mark, index) => {
              if (mark.position > viewportWidth) return null;

              return (
                <g key={`h-${index}`}>
                  <line
                    x1={mark.position}
                    y1={mark.isMajor ? 0 : 10}
                    x2={mark.position}
                    y2={40}
                    stroke="white"
                    strokeWidth={mark.isMajor ? 2 : 1}
                  />
                  {mark.label && (
                    <text
                      x={mark.position}
                      y={20}
                      fill="white"
                      fontSize="11"
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="500"
                    >
                      {mark.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Left vertical ruler */}
        <div className="absolute top-10 left-0 bottom-0 w-12">
          <svg className="w-full h-full">
            {verticalMarks.map((mark, index) => {
              if (mark.position > viewportHeight - 40) return null;

              return (
                <g key={`v-${index}`}>
                  <line
                    x1={mark.isMajor ? 0 : 8}
                    y1={mark.position}
                    x2={48}
                    y2={mark.position}
                    stroke="white"
                    strokeWidth={mark.isMajor ? 2 : 1}
                  />
                  {mark.label && (
                    <text
                      x={24}
                      y={mark.position + 4}
                      fill="white"
                      fontSize="11"
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="500"
                      transform={`rotate(-90 24 ${mark.position + 4})`}
                    >
                      {mark.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }
);

export default ImageRulerOverlay;
