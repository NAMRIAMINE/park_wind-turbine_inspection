// // app/components/turbine/carousel-measurement.tsx
// import React, {
//   useState,
//   useRef,
//   useEffect,
//   useCallback,
//   useMemo,
// } from "react";
// import { Measurement, Point, TurbineImage } from "@/types";
// import { Button } from "../ui/button";
// import { Trash2, Save, Download, MapPin } from "lucide-react";
// import { Badge } from "../ui/badge";

// interface CarouselMeasurementProps {
//   image: TurbineImage;
//   measurements: Measurement[];
//   onMeasurementsUpdate: (measurements: Measurement[]) => void;
//   zoom: number;
//   pan: { x: number; y: number };
//   bladeContext?: {
//     minAltitude: number;
//     maxAltitude: number;
//     currentAltitude: number;
//     bladeLength: number;
//   };
// }

// export function CarouselMeasurement({
//   image,
//   measurements,
//   onMeasurementsUpdate,
//   zoom,
//   pan,
//   bladeContext,
// }: CarouselMeasurementProps) {
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [currentMeasurement, setCurrentMeasurement] = useState<{
//     start: Point;
//     end: Point;
//   } | null>(null);
//   const [containerDimensions, setContainerDimensions] = useState({
//     width: 0,
//     height: 0,
//   });
//   const [imageDimensions, setImageDimensions] = useState({
//     displayWidth: 0,
//     displayHeight: 0,
//     scale: 1,
//   });
//   const [hoveredMeasurement, setHoveredMeasurement] = useState<string | null>(
//     null
//   );

//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const overlayRef = useRef<HTMLDivElement>(null);

//   // Get GSD with proper error handling
//   const gsdCmPerPixel = image?.gsd?.gsd_cm_per_pixel || 0;
//   const isValidGSD = gsdCmPerPixel > 0 && !isNaN(gsdCmPerPixel);

//   // Memoized image fit calculation
//   const imageFitData = useMemo(() => {
//     if (!overlayRef.current || !image.width || !image.height) {
//       return {
//         scale: 1,
//         displayWidth: 0,
//         displayHeight: 0,
//         offsetX: 0,
//         offsetY: 0,
//       };
//     }

//     const containerWidth = overlayRef.current.clientWidth;
//     const containerHeight = overlayRef.current.clientHeight;

//     const scaleX = containerWidth / image.width;
//     const scaleY = containerHeight / image.height;
//     const fitScale = Math.min(scaleX, scaleY, 1);

//     const displayWidth = image.width * fitScale;
//     const displayHeight = image.height * fitScale;

//     const offsetX = (containerWidth - displayWidth) / 2;
//     const offsetY = (containerHeight - displayHeight) / 2;

//     return { scale: fitScale, displayWidth, displayHeight, offsetX, offsetY };
//   }, [image.width, image.height, containerDimensions]);

//   // Update container and image dimensions
//   useEffect(() => {
//     const updateDimensions = () => {
//       if (overlayRef.current) {
//         const rect = overlayRef.current.getBoundingClientRect();
//         setContainerDimensions({
//           width: rect.width,
//           height: rect.height,
//         });

//         setImageDimensions({
//           displayWidth: imageFitData.displayWidth,
//           displayHeight: imageFitData.displayHeight,
//           scale: imageFitData.scale,
//         });
//       }
//     };

//     updateDimensions();
//     const resizeObserver = new ResizeObserver(updateDimensions);
//     if (overlayRef.current) {
//       resizeObserver.observe(overlayRef.current);
//     }

//     return () => resizeObserver.disconnect();
//   }, [imageFitData]);

//   // Convert mouse coordinates to image coordinates
//   const getCursorCoords = useCallback(
//     (e: React.MouseEvent): Point | null => {
//       const rect = overlayRef.current?.getBoundingClientRect();
//       if (!rect || !imageFitData.scale) return null;

//       const mouseX = e.clientX - rect.left;
//       const mouseY = e.clientY - rect.top;

//       // Account for zoom and pan transformations
//       const unpannedX = mouseX - pan.x;
//       const unpannedY = mouseY - pan.y;

//       const centerX = rect.width / 2;
//       const centerY = rect.height / 2;
//       const unzoomedX = (unpannedX - centerX) / zoom + centerX;
//       const unzoomedY = (unpannedY - centerY) / zoom + centerY;

//       // Convert to image coordinates
//       const imageX = (unzoomedX - imageFitData.offsetX) / imageFitData.scale;
//       const imageY = (unzoomedY - imageFitData.offsetY) / imageFitData.scale;

//       // Clamp to image bounds
//       const clampedX = Math.max(0, Math.min(image.width, imageX));
//       const clampedY = Math.max(0, Math.min(image.height, imageY));

//       return { x: clampedX, y: clampedY };
//     },
//     [imageFitData, zoom, pan, image.width, image.height]
//   );

//   // Convert image coordinates to canvas coordinates for drawing
//   const imageToCanvasCoords = useCallback(
//     (point: Point): Point => {
//       const displayX = point.x * imageFitData.scale + imageFitData.offsetX;
//       const displayY = point.y * imageFitData.scale + imageFitData.offsetY;

//       const centerX = containerDimensions.width / 2;
//       const centerY = containerDimensions.height / 2;

//       const zoomedX = (displayX - centerX) * zoom + centerX;
//       const zoomedY = (displayY - centerY) * zoom + centerY;

//       const pannedX = zoomedX + pan.x;
//       const pannedY = zoomedY + pan.y;

//       return { x: pannedX, y: pannedY };
//     },
//     [imageFitData, zoom, pan, containerDimensions]
//   );

//   // Enhanced distance calculation with absolute positioning
//   const calculateDistance = useCallback(
//     (start: Point, end: Point) => {
//       if (!isValidGSD) {
//         return {
//           distance: 0,
//           distanceCm: 0,
//           pixelDistance: 0,
//           absolutePosition: null,
//           valid: false,
//         };
//       }

//       const pixelDistance = Math.sqrt(
//         Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
//       );

//       const realDistanceCm = pixelDistance * gsdCmPerPixel;
//       const realDistanceM = realDistanceCm / 100;

//       // Calculate absolute position if blade context is available
//       let absolutePosition = null;
//       if (bladeContext) {
//         const midPointY = (start.y + end.y) / 2;
//         const relativeHeightCm = midPointY * gsdCmPerPixel;
//         const relativeHeightM = relativeHeightCm / 100;
//         const absoluteAltitude = bladeContext.currentAltitude + relativeHeightM;
//         const bladePercentage =
//           ((absoluteAltitude - bladeContext.minAltitude) /
//             bladeContext.bladeLength) *
//           100;

//         absolutePosition = {
//           altitude: absoluteAltitude,
//           baseAltitude: bladeContext.currentAltitude,
//           relativeHeight: relativeHeightM,
//           bladePercentage: Math.max(0, Math.min(100, bladePercentage)),
//         };
//       }

//       return {
//         distance: realDistanceM,
//         distanceCm: realDistanceCm,
//         pixelDistance: pixelDistance,
//         absolutePosition,
//         valid: pixelDistance > 3, // Minimum 3 pixels
//       };
//     },
//     [gsdCmPerPixel, isValidGSD, bladeContext]
//   );

//   const formatDistance = useCallback((distanceM: number) => {
//     if (distanceM < 0.01) return `${(distanceM * 1000).toFixed(1)}mm`;
//     if (distanceM < 1) return `${(distanceM * 100).toFixed(1)}cm`;
//     return `${distanceM.toFixed(2)}m`;
//   }, []);

//   // Mouse event handlers
//   const handleMouseDown = useCallback(
//     (e: React.MouseEvent) => {
//       if (!isValidGSD) return;

//       const coords = getCursorCoords(e);
//       if (!coords) return;

//       setIsDrawing(true);
//       setCurrentMeasurement({ start: coords, end: coords });
//     },
//     [isValidGSD, getCursorCoords]
//   );

//   const handleMouseMove = useCallback(
//     (e: React.MouseEvent) => {
//       if (!isDrawing || !currentMeasurement || !isValidGSD) return;

//       const coords = getCursorCoords(e);
//       if (!coords) return;

//       setCurrentMeasurement({ ...currentMeasurement, end: coords });
//     },
//     [isDrawing, currentMeasurement, isValidGSD, getCursorCoords]
//   );

//   const handleMouseUp = useCallback(
//     (e: React.MouseEvent) => {
//       if (!isDrawing || !currentMeasurement || !isValidGSD) return;

//       const coords = getCursorCoords(e);
//       if (!coords) return;

//       const final = { ...currentMeasurement, end: coords };
//       const result = calculateDistance(final.start, final.end);

//       if (result.valid) {
//         const newMeasurement: Measurement = {
//           id: Date.now().toString(),
//           start: final.start,
//           end: final.end,
//           distance: result.distanceCm,
//           gsd_used: gsdCmPerPixel,
//           absolutePosition: result.absolutePosition ?? undefined,
//           createdAt: new Date(),
//         };

//         onMeasurementsUpdate([...measurements, newMeasurement]);
//       }

//       setIsDrawing(false);
//       setCurrentMeasurement(null);
//     },
//     [
//       isDrawing,
//       currentMeasurement,
//       isValidGSD,
//       getCursorCoords,
//       calculateDistance,
//       gsdCmPerPixel,
//       measurements,
//       onMeasurementsUpdate,
//     ]
//   );

//   // Enhanced drawing function
//   const draw = useCallback(() => {
//     const canvas = canvasRef.current;
//     const ctx = canvas?.getContext("2d");
//     const container = overlayRef.current;
//     if (!canvas || !ctx || !container) return;

//     canvas.width = container.clientWidth;
//     canvas.height = container.clientHeight;
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     // Setup drawing styles
//     ctx.strokeStyle = "#10b981";
//     ctx.fillStyle = "#10b981";
//     ctx.lineWidth = 2;
//     ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";

//     const drawMeasurementLine = (
//       m: Measurement,
//       isHovered: boolean = false
//     ) => {
//       const startCanvas = imageToCanvasCoords(m.start);
//       const endCanvas = imageToCanvasCoords(m.end);

//       const midX = (startCanvas.x + endCanvas.x) / 2;
//       const midY = (startCanvas.y + endCanvas.y) / 2;

//       // Skip if outside visible area
//       const margin = 100;
//       if (
//         (startCanvas.x < -margin && endCanvas.x < -margin) ||
//         (startCanvas.x > canvas.width + margin &&
//           endCanvas.x > canvas.width + margin) ||
//         (startCanvas.y < -margin && endCanvas.y < -margin) ||
//         (startCanvas.y > canvas.height + margin &&
//           endCanvas.y > canvas.height + margin)
//       ) {
//         return;
//       }

//       // Enhanced styling for hovered measurement
//       if (isHovered) {
//         ctx.strokeStyle = "#f59e0b";
//         ctx.fillStyle = "#f59e0b";
//         ctx.lineWidth = 3;
//       } else {
//         ctx.strokeStyle = "#10b981";
//         ctx.fillStyle = "#10b981";
//         ctx.lineWidth = 2;
//       }

//       // Draw line
//       ctx.beginPath();
//       ctx.moveTo(startCanvas.x, startCanvas.y);
//       ctx.lineTo(endCanvas.x, endCanvas.y);
//       ctx.stroke();

//       // Draw endpoints
//       ctx.beginPath();
//       ctx.arc(startCanvas.x, startCanvas.y, isHovered ? 5 : 4, 0, 2 * Math.PI);
//       ctx.fill();
//       ctx.beginPath();
//       ctx.arc(endCanvas.x, endCanvas.y, isHovered ? 5 : 4, 0, 2 * Math.PI);
//       ctx.fill();

//       // Draw enhanced label
//       const distanceM = (m.distance || 0) / 100;
//       const label = formatDistance(distanceM);
//       const labelWidth = ctx.measureText(label).width + 12;
//       const labelHeight = 24;

//       // Background for label
//       ctx.fillStyle = isHovered
//         ? "rgba(245,158,11,0.95)"
//         : "rgba(16,185,129,0.95)";
//       ctx.fillRect(
//         midX - labelWidth / 2,
//         midY - labelHeight / 2,
//         labelWidth,
//         labelHeight
//       );

//       // Label text
//       ctx.fillStyle = "#ffffff";
//       ctx.textAlign = "center";
//       ctx.textBaseline = "middle";
//       ctx.font = isHovered
//         ? "bold 12px -apple-system, BlinkMacSystemFont, sans-serif"
//         : "12px -apple-system, BlinkMacSystemFont, sans-serif";
//       ctx.fillText(label, midX, midY);

//       // Show absolute position if available
//       if (m.absolutePosition && isHovered) {
//         const absoluteLabel = `${m.absolutePosition.altitude.toFixed(1)}m alt`;
//         const absoluteLabelWidth = ctx.measureText(absoluteLabel).width + 8;

//         ctx.fillStyle = "rgba(59,130,246,0.95)";
//         ctx.fillRect(
//           midX - absoluteLabelWidth / 2,
//           midY + 15,
//           absoluteLabelWidth,
//           16
//         );

//         ctx.fillStyle = "#ffffff";
//         ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
//         ctx.fillText(absoluteLabel, midX, midY + 23);
//       }
//     };

//     // Draw existing measurements
//     measurements.forEach((m) => {
//       drawMeasurementLine(m, m.id === hoveredMeasurement);
//     });

//     // Draw current measurement being drawn
//     if (currentMeasurement && isDrawing && isValidGSD) {
//       const result = calculateDistance(
//         currentMeasurement.start,
//         currentMeasurement.end
//       );
//       if (result.valid) {
//         const tempMeasurement: Measurement = {
//           id: "temp",
//           start: currentMeasurement.start,
//           end: currentMeasurement.end,
//           distance: result.distanceCm,
//           gsd_used: gsdCmPerPixel,
//           absolutePosition: result.absolutePosition ?? undefined,
//         };
//         drawMeasurementLine(tempMeasurement, false);
//       }
//     }
//   }, [
//     measurements,
//     currentMeasurement,
//     isDrawing,
//     imageToCanvasCoords,
//     calculateDistance,
//     gsdCmPerPixel,
//     isValidGSD,
//     hoveredMeasurement,
//     formatDistance,
//   ]);

//   useEffect(() => {
//     draw();
//   }, [draw]);

//   // Delete measurement
//   const deleteMeasurement = useCallback(
//     (id: string) => {
//       onMeasurementsUpdate(measurements.filter((m) => m.id !== id));
//     },
//     [measurements, onMeasurementsUpdate]
//   );

//   // Clear all measurements
//   const clearAllMeasurements = useCallback(() => {
//     onMeasurementsUpdate([]);
//   }, [onMeasurementsUpdate]);

//   if (!isValidGSD) {
//     return (
//       <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
//         <div className="bg-red-600 text-white p-4 rounded-lg max-w-md text-center">
//           <h3 className="font-semibold mb-2">Measurement Unavailable</h3>
//           <p className="text-sm">
//             Cannot measure this image - no valid Ground Sample Distance (GSD)
//             data found.
//           </p>
//           <div className="mt-3 text-xs opacity-90">
//             <div>GSD: {gsdCmPerPixel.toFixed(6)} cm/pixel</div>
//             <div>Distance: {image?.gsd?.distance_to_blade || "N/A"} m</div>
//             <div>Source: {image?.gsd?.distance_source || "N/A"}</div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div
//       ref={overlayRef}
//       className="absolute inset-0 pointer-events-auto"
//       style={{ cursor: "crosshair" }}
//       onMouseDown={handleMouseDown}
//       onMouseMove={handleMouseMove}
//       onMouseUp={handleMouseUp}
//       onMouseLeave={() => {
//         setIsDrawing(false);
//         setCurrentMeasurement(null);
//       }}
//     >
//       <canvas
//         ref={canvasRef}
//         className="absolute inset-0 w-full h-full pointer-events-none"
//       />

//       {/* Enhanced measurement list */}
//       {measurements.length > 0 && (
//         <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-sm">
//           <div className="p-3">
//             <div className="flex items-center justify-between mb-2">
//               <h3 className="font-semibold text-sm">Measurements</h3>
//               <Button
//                 size="sm"
//                 variant="destructive"
//                 onClick={clearAllMeasurements}
//                 className="h-6 px-2 text-xs"
//               >
//                 <Trash2 className="h-3 w-3" />
//               </Button>
//             </div>
//             <div className="space-y-1 max-h-40 overflow-y-auto">
//               {measurements.map((m, index) => (
//                 <div
//                   key={m.id}
//                   className={`flex items-center justify-between p-2 rounded text-xs transition-colors ${
//                     m.id === hoveredMeasurement
//                       ? "bg-yellow-100 border border-yellow-300"
//                       : "bg-gray-50 hover:bg-gray-100"
//                   }`}
//                   onMouseEnter={() => setHoveredMeasurement(m.id)}
//                   onMouseLeave={() => setHoveredMeasurement(null)}
//                 >
//                   <div className="flex-1">
//                     <div className="font-medium">
//                       {formatDistance((m.distance || 0) / 100)}
//                     </div>
//                     {m.absolutePosition && (
//                       <div className="text-gray-600 text-xs">
//                         <div>
//                           Alt: {m.absolutePosition.altitude.toFixed(1)}m
//                         </div>
//                         <div>
//                           Blade: {m.absolutePosition.bladePercentage.toFixed(1)}
//                           %
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                   <Button
//                     size="sm"
//                     variant="ghost"
//                     onClick={() => deleteMeasurement(m.id)}
//                     className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
//                   >
//                     <Trash2 className="h-3 w-3" />
//                   </Button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Enhanced debug info */}
//       <div className="absolute bottom-4 left-4 bg-black/70 text-white p-2 rounded text-xs">
//         <div className="space-y-1">
//           <div>GSD: {gsdCmPerPixel.toFixed(4)} cm/px</div>
//           <div>
//             Distance: {image.gsd?.distance_to_blade?.toFixed(1) || "N/A"} m
//           </div>
//           <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
//           <div>Measurements: {measurements.length}</div>
//           {bladeContext && (
//             <div className="border-t border-gray-500 pt-1 mt-1">
//               <div>Blade: {bladeContext.bladeLength.toFixed(1)}m</div>
//               <div>Current: {bladeContext.currentAltitude.toFixed(1)}m</div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// app/components/turbine/carousel-measurement.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Measurement, Point, TurbineImage } from "@/types";
import { Button } from "../ui/button";
import { Trash2, Target } from "lucide-react";
import { Badge } from "../ui/badge";
import { isNumber, isNil } from "lodash-es";

interface CarouselMeasurementProps {
  image: TurbineImage;
  measurements: Measurement[];
  onMeasurementsUpdate: (measurements: Measurement[]) => void;
  zoom: number;
  pan: { x: number; y: number };
  bladeContext?: {
    minAltitude: number;
    maxAltitude: number;
    currentAltitude: number;
    bladeLength: number;
  };
}

// Safe number helper functions
const safeNumber = (value: any, fallback: number = 0): number => {
  if (isNil(value) || !isNumber(value) || isNaN(value)) {
    return fallback;
  }
  return value;
};

const safeToFixed = (value: any, digits: number = 2): string => {
  const num = safeNumber(value);
  return num.toFixed(digits);
};

export function CarouselMeasurement({
  image,
  measurements,
  onMeasurementsUpdate,
  zoom,
  pan,
  bladeContext,
}: CarouselMeasurementProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<{
    start: Point;
    end: Point;
  } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [hoveredMeasurement, setHoveredMeasurement] = useState<string | null>(
    null
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Safe GSD extraction with fallbacks
  const gsdCmPerPixel = useMemo(() => {
    return safeNumber(image?.gsd?.gsd_cm_per_pixel, 0);
  }, [image?.gsd?.gsd_cm_per_pixel]);

  const isValidGSD = gsdCmPerPixel > 0;

  // Memoized image fit calculation with safe values
  const imageFitData = useMemo(() => {
    if (!overlayRef.current || !image?.width || !image?.height) {
      return {
        scale: 1,
        displayWidth: 0,
        displayHeight: 0,
        offsetX: 0,
        offsetY: 0,
      };
    }

    const containerWidth = overlayRef.current.clientWidth;
    const containerHeight = overlayRef.current.clientHeight;

    const imageWidth = safeNumber(image.width, 1);
    const imageHeight = safeNumber(image.height, 1);

    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);

    const displayWidth = imageWidth * fitScale;
    const displayHeight = imageHeight * fitScale;

    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    return { scale: fitScale, displayWidth, displayHeight, offsetX, offsetY };
  }, [image?.width, image?.height, containerDimensions]);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (overlayRef.current) {
        const rect = overlayRef.current.getBoundingClientRect();
        setContainerDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (overlayRef.current) {
      resizeObserver.observe(overlayRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Convert mouse coordinates to image coordinates with safety checks
  const getCursorCoords = useCallback(
    (e: React.MouseEvent): Point | null => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect || !imageFitData.scale) return null;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Account for zoom and pan transformations with safe values
      const safeZoom = safeNumber(zoom, 1);
      const safePanX = safeNumber(pan.x, 0);
      const safePanY = safeNumber(pan.y, 0);

      const unpannedX = mouseX - safePanX;
      const unpannedY = mouseY - safePanY;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const unzoomedX = (unpannedX - centerX) / safeZoom + centerX;
      const unzoomedY = (unpannedY - centerY) / safeZoom + centerY;

      // Convert to image coordinates
      const imageX = (unzoomedX - imageFitData.offsetX) / imageFitData.scale;
      const imageY = (unzoomedY - imageFitData.offsetY) / imageFitData.scale;

      // Clamp to image bounds with safe values
      const imageWidth = safeNumber(image?.width, 1);
      const imageHeight = safeNumber(image?.height, 1);

      const clampedX = Math.max(0, Math.min(imageWidth, imageX));
      const clampedY = Math.max(0, Math.min(imageHeight, imageY));

      return { x: clampedX, y: clampedY };
    },
    [imageFitData, zoom, pan, image?.width, image?.height]
  );

  // Convert image coordinates to canvas coordinates with safety checks
  const imageToCanvasCoords = useCallback(
    (point: Point): Point => {
      const displayX = point.x * imageFitData.scale + imageFitData.offsetX;
      const displayY = point.y * imageFitData.scale + imageFitData.offsetY;

      const centerX = containerDimensions.width / 2;
      const centerY = containerDimensions.height / 2;

      const safeZoom = safeNumber(zoom, 1);
      const safePanX = safeNumber(pan.x, 0);
      const safePanY = safeNumber(pan.y, 0);

      const zoomedX = (displayX - centerX) * safeZoom + centerX;
      const zoomedY = (displayY - centerY) * safeZoom + centerY;

      const pannedX = zoomedX + safePanX;
      const pannedY = zoomedY + safePanY;

      return { x: pannedX, y: pannedY };
    },
    [imageFitData, zoom, pan, containerDimensions]
  );

  // Enhanced distance calculation with absolute positioning and safety checks
  const calculateDistance = useCallback(
    (start: Point, end: Point) => {
      if (!isValidGSD) {
        return {
          distance: 0,
          distanceCm: 0,
          pixelDistance: 0,
          absolutePosition: null,
          valid: false,
        };
      }

      const startX = safeNumber(start.x, 0);
      const startY = safeNumber(start.y, 0);
      const endX = safeNumber(end.x, 0);
      const endY = safeNumber(end.y, 0);

      const pixelDistance = Math.sqrt(
        Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
      );

      const realDistanceCm = pixelDistance * gsdCmPerPixel;
      const realDistanceM = realDistanceCm / 100;

      // Calculate absolute position if blade context is available
      let absolutePosition = null;
      if (bladeContext) {
        const midPointY = (startY + endY) / 2;
        const relativeHeightCm = midPointY * gsdCmPerPixel;
        const relativeHeightM = relativeHeightCm / 100;
        const currentAltitude = safeNumber(bladeContext.currentAltitude, 0);
        const absoluteAltitude = currentAltitude + relativeHeightM;
        const minAltitude = safeNumber(bladeContext.minAltitude, 0);
        const bladeLength = safeNumber(bladeContext.bladeLength, 1);
        const bladePercentage =
          ((absoluteAltitude - minAltitude) / bladeLength) * 100;

        absolutePosition = {
          altitude: absoluteAltitude,
          baseAltitude: currentAltitude,
          relativeHeight: relativeHeightM,
          bladePercentage: Math.max(0, Math.min(100, bladePercentage)),
        };
      }

      return {
        distance: realDistanceM,
        distanceCm: realDistanceCm,
        pixelDistance: pixelDistance,
        absolutePosition,
        valid: pixelDistance > 2,
      };
    },
    [gsdCmPerPixel, isValidGSD, bladeContext]
  );

  const formatDistance = useCallback((distanceM: number) => {
    const safeDistanceM = safeNumber(distanceM, 0);
    if (safeDistanceM < 0.01)
      return `${safeToFixed(safeDistanceM * 1000, 1)}mm`;
    if (safeDistanceM < 1) return `${safeToFixed(safeDistanceM * 100, 1)}cm`;
    return `${safeToFixed(safeDistanceM, 2)}m`;
  }, []);

  // Mouse event handlers with safety checks
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isValidGSD) return;

      const coords = getCursorCoords(e);
      if (!coords) return;

      setIsDrawing(true);
      setCurrentMeasurement({ start: coords, end: coords });
    },
    [isValidGSD, getCursorCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !currentMeasurement || !isValidGSD) return;

      const coords = getCursorCoords(e);
      if (!coords) return;

      setCurrentMeasurement({ ...currentMeasurement, end: coords });
    },
    [isDrawing, currentMeasurement, isValidGSD, getCursorCoords]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !currentMeasurement || !isValidGSD) return;

      const coords = getCursorCoords(e);
      if (!coords) return;

      const final = { ...currentMeasurement, end: coords };
      const result = calculateDistance(final.start, final.end);

      if (result.valid) {
        const newMeasurement: Measurement = {
          id: Date.now().toString(),
          start: final.start,
          end: final.end,
          distance: safeNumber(result.distanceCm, 0),
          gsd_used: gsdCmPerPixel,
          absolutePosition: result.absolutePosition ?? undefined,
          createdAt: new Date(),
        };

        onMeasurementsUpdate([...measurements, newMeasurement]);
      }

      setIsDrawing(false);
      setCurrentMeasurement(null);
    },
    [
      isDrawing,
      currentMeasurement,
      isValidGSD,
      getCursorCoords,
      calculateDistance,
      gsdCmPerPixel,
      measurements,
      onMeasurementsUpdate,
    ]
  );

  // Enhanced drawing function with safety checks
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const container = overlayRef.current;
    if (!canvas || !ctx || !container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Setup drawing styles
    ctx.strokeStyle = "#10b981";
    ctx.fillStyle = "#10b981";
    ctx.lineWidth = 1;
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";

    const drawMeasurementLine = (
      m: Measurement,
      isHovered: boolean = false
    ) => {
      const startCanvas = imageToCanvasCoords(m.start);
      const endCanvas = imageToCanvasCoords(m.end);

      const midX = (startCanvas.x + endCanvas.x) / 2;
      const midY = (startCanvas.y + endCanvas.y) / 2;

      // Skip if outside visible area
      const margin = 100;
      if (
        (startCanvas.x < -margin && endCanvas.x < -margin) ||
        (startCanvas.x > canvas.width + margin &&
          endCanvas.x > canvas.width + margin) ||
        (startCanvas.y < -margin && endCanvas.y < -margin) ||
        (startCanvas.y > canvas.height + margin &&
          endCanvas.y > canvas.height + margin)
      ) {
        return;
      }

      // Enhanced styling for hovered measurement
      if (isHovered) {
        ctx.strokeStyle = "#f59e0b";
        ctx.fillStyle = "#f59e0b";
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = "#10b981";
        ctx.fillStyle = "#10b981";
        ctx.lineWidth = 1;
      }

      // Draw line
      ctx.beginPath();
      ctx.moveTo(startCanvas.x, startCanvas.y);
      ctx.lineTo(endCanvas.x, endCanvas.y);
      ctx.stroke();

      // Draw endpoints
      // ctx.beginPath();
      // ctx.arc(startCanvas.x, startCanvas.y, isHovered ? 5 : 4, 0, 2 * Math.PI);
      // ctx.fill();
      // ctx.beginPath();
      // ctx.arc(endCanvas.x, endCanvas.y, isHovered ? 5 : 4, 0, 2 * Math.PI);
      // ctx.fill();

      // Draw enhanced label with safe values
      const distanceM = safeNumber(m.distance, 0) / 100;
      const label = formatDistance(distanceM);
      const labelWidth = ctx.measureText(label).width + 12;
      const labelHeight = 24;

      // Background for label
      ctx.fillStyle = isHovered
        ? "rgba(245,158,11,0.95)"
        : "rgba(16,185,129,0.95)";
      ctx.fillRect(
        midX - labelWidth / 2,
        midY - labelHeight / 2,
        labelWidth,
        labelHeight
      );

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = isHovered
        ? "bold 12px -apple-system, BlinkMacSystemFont, sans-serif"
        : "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(label, midX, midY);

      // Show absolute position if available
      if (m.absolutePosition && isHovered) {
        const altitude = safeNumber(m.absolutePosition.altitude, 0);
        const absoluteLabel = `${safeToFixed(altitude, 1)}m alt`;
        const absoluteLabelWidth = ctx.measureText(absoluteLabel).width + 8;

        ctx.fillStyle = "rgba(59,130,246,0.95)";
        ctx.fillRect(
          midX - absoluteLabelWidth / 2,
          midY + 15,
          absoluteLabelWidth,
          16
        );

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(absoluteLabel, midX, midY + 23);
      }
    };

    // Draw existing measurements
    measurements.forEach((m) => {
      drawMeasurementLine(m, m.id === hoveredMeasurement);
    });

    // Draw current measurement being drawn
    if (currentMeasurement && isDrawing && isValidGSD) {
      const result = calculateDistance(
        currentMeasurement.start,
        currentMeasurement.end
      );
      if (result.valid) {
        const tempMeasurement: Measurement = {
          id: "temp",
          start: currentMeasurement.start,
          end: currentMeasurement.end,
          distance: safeNumber(result.distanceCm, 0),
          gsd_used: gsdCmPerPixel,
          absolutePosition: result.absolutePosition ?? undefined,
        };
        drawMeasurementLine(tempMeasurement, false);
      }
    }
  }, [
    measurements,
    currentMeasurement,
    isDrawing,
    imageToCanvasCoords,
    calculateDistance,
    gsdCmPerPixel,
    isValidGSD,
    hoveredMeasurement,
    formatDistance,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Delete measurement
  const deleteMeasurement = useCallback(
    (id: string) => {
      onMeasurementsUpdate(measurements.filter((m) => m.id !== id));
    },
    [measurements, onMeasurementsUpdate]
  );

  // Clear all measurements
  const clearAllMeasurements = useCallback(() => {
    onMeasurementsUpdate([]);
  }, [onMeasurementsUpdate]);

  if (!isValidGSD) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
        <div className="bg-red-600 text-white p-4 rounded-lg max-w-md text-center">
          <h3 className="font-semibold mb-2">Measurement Unavailable</h3>
          <p className="text-sm">
            Cannot measure this image - no valid Ground Sample Distance (GSD)
            data found.
          </p>
          <div className="mt-3 text-xs opacity-90">
            <div>GSD: {safeToFixed(gsdCmPerPixel, 6)} cm/pixel</div>
            <div>
              Distance: {safeToFixed(image?.gsd?.distance_to_blade, 1) || "N/A"}{" "}
              m
            </div>
            <div>Source: {image?.gsd?.distance_source || "N/A"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ cursor: "crosshair" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDrawing(false);
        setCurrentMeasurement(null);
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Enhanced measurement list */}
      {measurements.length > 0 && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-sm">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Measurements</h3>
              <Button
                size="sm"
                variant="destructive"
                onClick={clearAllMeasurements}
                className="h-6 px-2 text-xs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {measurements.map((m, index) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-2 rounded text-xs transition-colors ${
                    m.id === hoveredMeasurement
                      ? "bg-yellow-100 border border-yellow-300"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onMouseEnter={() => setHoveredMeasurement(m.id)}
                  onMouseLeave={() => setHoveredMeasurement(null)}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {formatDistance(safeNumber(m.distance, 0) / 100)}
                    </div>
                    {m.absolutePosition && (
                      <div className="text-gray-600 text-xs">
                        <div>
                          Alt: {safeToFixed(m.absolutePosition.altitude, 1)}m
                        </div>
                        <div>
                          Blade:{" "}
                          {safeToFixed(m.absolutePosition.bladePercentage, 1)}%
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMeasurement(m.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
