// app/components/turbine/carousel-image-display.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle, Loader2, ZoomIn } from "lucide-react";
import { TurbineImage } from "@/types";
import Image from "next/image";

interface CarouselImageDisplayProps {
  image: TurbineImage;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  onPanChange?: (pan: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number, focusPoint?: { x: number; y: number }) => void;
}

export function CarouselImageDisplay({
  image,
  zoom,
  pan,
  isDragging,
  onPanChange,
  onZoomChange,
}: CarouselImageDisplayProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [lastClickTime, setLastClickTime] = useState(0);
  const [doubleClickHint, setDoubleClickHint] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const calculateImageFit = useCallback(() => {
    if (
      !containerRef.current ||
      !imageDimensions.width ||
      !imageDimensions.height
    ) {
      return { scale: 1, width: 0, height: 0 };
    }

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;
    const fitScale = Math.min(scaleX, scaleY, 1);

    const fitWidth = imageDimensions.width * fitScale;
    const fitHeight = imageDimensions.height * fitScale;

    return { scale: fitScale, width: fitWidth, height: fitHeight };
  }, [imageDimensions]);

  const calculatePanBounds = useCallback(() => {
    if (
      !containerRef.current ||
      !imageDimensions.width ||
      !imageDimensions.height
    ) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const { scale: fitScale } = calculateImageFit();
    const currentScale = fitScale * zoom;

    const scaledImageWidth = imageDimensions.width * currentScale;
    const scaledImageHeight = imageDimensions.height * currentScale;

    const maxPanX = Math.max(0, (scaledImageWidth - containerWidth) / 2);
    const maxPanY = Math.max(0, (scaledImageHeight - containerHeight) / 2);

    return {
      minX: -maxPanX,
      maxX: maxPanX,
      minY: -maxPanY,
      maxY: maxPanY,
    };
  }, [imageDimensions, zoom, calculateImageFit]);

  const constrainPan = useCallback(
    (newPan: { x: number; y: number }) => {
      const bounds = calculatePanBounds();
      return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, newPan.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, newPan.y)),
      };
    },
    [calculatePanBounds]
  );

  useEffect(() => {
    if (onPanChange) {
      const constrainedPan = constrainPan(pan);
      if (constrainedPan.x !== pan.x || constrainedPan.y !== pan.y) {
        onPanChange(constrainedPan);
      }
    }
  }, [zoom, pan, constrainPan, onPanChange]);

  // Enhanced double-click zoom functionality
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onZoomChange || !containerRef.current) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastClickTime;

      if (timeDiff < 300) {
        // Double-click detected
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Calculate the focus point relative to container center
        const focusPoint = {
          x: clickX - rect.width / 2,
          y: clickY - rect.height / 2,
        };

        // Smart zoom: zoom in if < 2x, zoom out if >= 2x
        const newZoom = zoom < 2 ? 2.5 : 1;
        onZoomChange(newZoom, focusPoint);

        // Hide double-click hint after use
        setDoubleClickHint(false);
      } else {
        // Single click - show hint briefly if not zoomed
        if (zoom <= 1.1) {
          setDoubleClickHint(true);
          setTimeout(() => setDoubleClickHint(false), 2000);
        }
      }

      setLastClickTime(currentTime);
    },
    [zoom, onZoomChange, lastClickTime]
  );

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  // Reset state when image changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setDoubleClickHint(false);
  }, [image.id]);

  const {
    scale: fitScale,
    width: fitWidth,
    height: fitHeight,
  } = calculateImageFit();

  if (imageError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600 text-lg font-medium mb-2">
          Failed to load image
        </p>
        <p className="text-gray-500 text-sm text-center px-4 mb-2">
          {image.name}
        </p>
        <p className="text-gray-400 text-xs">{image.orig_img_src}</p>
        <button
          onClick={() => {
            setImageError(false);
            setImageLoaded(false);
          }}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{
        minHeight: "400px",
        cursor: zoom > 1.1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
      }}
      onClick={handleClick}
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading image...</p>
        </div>
      )}

      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isDragging
            ? "none"
            : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "center center",
        }}
      >
        <Image
          ref={imageRef}
          src={image.orig_img_src}
          width={image.width}
          height={image.height}
          alt={`${image.blade}-${image.side} - ${image.name}`}
          className="block max-w-none select-none rotate-180"
          style={{
            width: `${fitWidth}px`,
            height: `${fitHeight}px`,
            opacity: imageLoaded ? 1 : 0,
          }}
          draggable={false}
          onLoad={handleImageLoad}
          onError={handleImageError}
          priority={true}
        />
      </div>

      {/* Enhanced zoom indicator */}
      {imageLoaded && zoom > 1 && (
        <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                zoom <= 1.5
                  ? "bg-green-400"
                  : zoom <= 2.5
                  ? "bg-yellow-400"
                  : "bg-red-400"
              }`}
            />
            <span className="font-medium">
              {zoom <= 1.5 ? "Optimal" : zoom <= 2.5 ? "Good" : "High Zoom"}
            </span>
            <span className="opacity-75">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Enhanced center crosshair for zoom > 1.2 */}
      {zoom > 1.2 && imageLoaded && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 w-6 h-6 border-2 border-white/60 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg" />
          <div className="absolute top-1/2 left-1/2 w-px h-12 bg-white/40 -translate-x-1/2 -translate-y-1/2 shadow-sm" />
          <div className="absolute top-1/2 left-1/2 w-12 h-px bg-white/40 -translate-x-1/2 -translate-y-1/2 shadow-sm" />
        </div>
      )}
    </div>
  );
}
