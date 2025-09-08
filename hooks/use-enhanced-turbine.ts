// app/hooks/use-enhanced-turbine.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TurbineImage,
  Measurement,
  FilterState,
  ViewState,
  TurbineSettings,
  Statistics,
} from "@/types";
import { fetchTurbineData } from "@/lib/turbine-api";
import {
  imagePreloader,
  keyboardManager,
  StorageUtils,
  AnimationUtils,
  debounce,
  throttle,
  PerformanceMonitor,
} from "@/lib/performance-utils";
import {
  calculateBladeMetrics,
  calculateImagePosition,
  findClosestImageToAltitude,
  getBladeInspectionStats,
} from "@/lib/blade-utils";

const DEFAULT_SETTINGS: TurbineSettings = {
  autoPreload: true,
  preloadRange: 2,
  animationDuration: 300,
  debounceDelay: 50,
  rulerOpacity: 0.8,
  defaultZoom: 1,
  keyboardShortcuts: true,
  persistMeasurements: true,
  showTooltips: true,
  theme: "auto",
  measurementPrecision: 2,
  autoSave: true,
  gridOverlay: false,
  showImageInfo: true,
};

const DEFAULT_VIEW_STATE: ViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  showRuler: true,
  showUI: true,
  measureMode: false,
  fullscreen: false,
  rulerOpacity: 0.8,
  crosshairVisible: true,
};

export function useEnhancedTurbine() {
  // Core state
  const [allImages, setAllImages] = useState<TurbineImage[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterState>({
    blade: "A",
    side: "TE",
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [measurements, setMeasurements] = useState<
    Record<string, Measurement[]>
  >({});
  const [settings, setSettings] = useState<TurbineSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for performance
  const containerRef = useRef<HTMLDivElement>(null);
  // const animationRef = useRef<number>();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        PerformanceMonitor.startTimer("data-load");
        setIsLoading(true);
        setError(null);
        const images = await fetchTurbineData();
        setAllImages(images);
        PerformanceMonitor.endTimer("data-load");
      } catch (err) {
        console.error("Failed to load turbine data:", err);
        setError("Failed to load turbine images. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = StorageUtils.loadSettings(
      "turbine-settings",
      DEFAULT_SETTINGS
    );
    const savedViewState = StorageUtils.loadSettings(
      "turbine-view-state",
      DEFAULT_VIEW_STATE
    );

    setSettings(savedSettings);
    setViewState(savedViewState);

    // Load measurements for all images
    if (savedSettings.persistMeasurements) {
      const loadMeasurements = async () => {
        const measurementData: Record<string, Measurement[]> = {};
        allImages.forEach((img) => {
          const imageMeasurements = StorageUtils.loadMeasurements(img.id);
          if (imageMeasurements.length > 0) {
            measurementData[img.id] = imageMeasurements;
          }
        });
        setMeasurements(measurementData);
      };

      if (allImages.length > 0) {
        loadMeasurements();
      }
    }
  }, [allImages]);

  // Save settings to localStorage
  useEffect(() => {
    if (settings.autoSave) {
      StorageUtils.saveSettings("turbine-settings", settings);
    }
  }, [settings]);

  useEffect(() => {
    if (settings.autoSave) {
      StorageUtils.saveSettings("turbine-view-state", viewState);
    }
  }, [viewState, settings.autoSave]);

  // Memoized filtered images
  const filteredImages = useMemo(() => {
    if (!allImages.length) return [];

    return allImages
      .filter(
        (img) =>
          img.blade === currentFilter.blade && img.side === currentFilter.side
      )
      .sort((a, b) => {
        const heightA = a.gsd?.flight_height || 0;
        const heightB = b.gsd?.flight_height || 0;
        return heightA - heightB;
      });
  }, [allImages, currentFilter]);

  // Current image
  const currentImage = useMemo(() => {
    return filteredImages[currentImageIndex] || null;
  }, [filteredImages, currentImageIndex]);

  // Enhanced blade context with inspection stats
  const bladeContext = useMemo(() => {
    if (!filteredImages.length) return null;

    const bladeMetrics = calculateBladeMetrics(filteredImages);
    const currentImagePosition = currentImage
      ? calculateImagePosition(currentImage, bladeMetrics)
      : null;

    const inspectionStats = getBladeInspectionStats(filteredImages);

    return {
      ...bladeMetrics,
      currentImagePosition,
      inspectionStats,
      currentAltitude:
        currentImage?.gsd?.flight_height || bladeMetrics.minAltitude,
    };
  }, [filteredImages, currentImage]);

  // Debounced view state updates
  const debouncedSetViewState = useMemo(
    () =>
      debounce((newViewState: Partial<ViewState>) => {
        setViewState((prev) => ({ ...prev, ...newViewState }));
      }, settings.debounceDelay),
    [settings.debounceDelay]
  );

  // Throttled preloading
  const throttledPreload = useMemo(
    () =>
      throttle((images: TurbineImage[], index: number) => {
        if (settings.autoPreload) {
          imagePreloader.preloadAdjacentImages(
            images,
            index,
            settings.preloadRange
          );
        }
      }, 1000),
    [settings.autoPreload, settings.preloadRange]
  );

  // Enhanced image navigation with performance monitoring
  const navigateToImage = useCallback(
    (index: number, animate: boolean = true) => {
      PerformanceMonitor.startTimer("navigation");

      const newIndex = Math.max(0, Math.min(index, filteredImages.length - 1));

      if (animate && settings.animationDuration > 0) {
        AnimationUtils.animateValue(
          currentImageIndex,
          newIndex,
          settings.animationDuration,
          (value) => setCurrentImageIndex(Math.round(value)),
          () => {
            setCurrentImageIndex(newIndex);
            throttledPreload(filteredImages, newIndex);
            PerformanceMonitor.endTimer("navigation");
          }
        );
      } else {
        setCurrentImageIndex(newIndex);
        throttledPreload(filteredImages, newIndex);
        PerformanceMonitor.endTimer("navigation");
      }

      // Reset view state when changing images
      if (newIndex !== currentImageIndex) {
        debouncedSetViewState({
          zoom: settings.defaultZoom,
          pan: { x: 0, y: 0 },
        });
      }
    },
    [
      filteredImages,
      currentImageIndex,
      settings.animationDuration,
      settings.defaultZoom,
      debouncedSetViewState,
      throttledPreload,
    ]
  );

  // Navigation functions
  const goToPrevious = useCallback(() => {
    if (currentImageIndex > 0) {
      navigateToImage(currentImageIndex - 1);
    }
  }, [currentImageIndex, navigateToImage]);

  const goToNext = useCallback(() => {
    if (currentImageIndex < filteredImages.length - 1) {
      navigateToImage(currentImageIndex + 1);
    }
  }, [currentImageIndex, filteredImages.length, navigateToImage]);

  // Enhanced navigation by blade position
  const navigateToBladePosition = useCallback(
    (relativePosition: number) => {
      if (!bladeContext || !filteredImages.length) return;

      const targetAltitude =
        bladeContext.minAltitude +
        relativePosition * bladeContext.altitudeRange;

      const result = findClosestImageToAltitude(filteredImages, targetAltitude);

      if (result) {
        navigateToImage(result.index);
      }
    },
    [bladeContext, filteredImages, navigateToImage]
  );

  // Navigate to specific altitude
  const navigateToAltitude = useCallback(
    (altitude: number) => {
      if (!filteredImages.length) return;

      const result = findClosestImageToAltitude(filteredImages, altitude);

      if (result) {
        navigateToImage(result.index);
      }
    },
    [filteredImages, navigateToImage]
  );

  // Enhanced filter change handler
  const handleFilterChange = useCallback(
    (newFilter: FilterState) => {
      setCurrentFilter(newFilter);
      setCurrentImageIndex(0);

      // Reset view state
      debouncedSetViewState({
        ...DEFAULT_VIEW_STATE,
        showRuler: viewState.showRuler,
        showUI: viewState.showUI,
      });
    },
    [debouncedSetViewState, viewState.showRuler, viewState.showUI]
  );

  // Zoom controls with bounds checking
  const handleZoom = useCallback(
    (factor: number, focusPoint?: { x: number; y: number }) => {
      const newZoom = Math.max(0.5, Math.min(5, viewState.zoom * factor));

      let newPan = viewState.pan;
      if (focusPoint && newZoom !== viewState.zoom) {
        const zoomRatio = newZoom / viewState.zoom;
        newPan = {
          x: focusPoint.x + (viewState.pan.x - focusPoint.x) * zoomRatio,
          y: focusPoint.y + (viewState.pan.y - focusPoint.y) * zoomRatio,
        };
      }

      debouncedSetViewState({ zoom: newZoom, pan: newPan });
    },
    [viewState.zoom, viewState.pan, debouncedSetViewState]
  );

  // Set zoom directly (for double-click zoom)
  const setZoom = useCallback(
    (newZoom: number, focusPoint?: { x: number; y: number }) => {
      const clampedZoom = Math.max(0.5, Math.min(5, newZoom));

      let newPan = viewState.pan;
      if (focusPoint && clampedZoom !== viewState.zoom) {
        const zoomRatio = clampedZoom / viewState.zoom;
        newPan = {
          x: focusPoint.x + (viewState.pan.x - focusPoint.x) * zoomRatio,
          y: focusPoint.y + (viewState.pan.y - focusPoint.y) * zoomRatio,
        };
      }

      debouncedSetViewState({ zoom: clampedZoom, pan: newPan });
    },
    [viewState.zoom, viewState.pan, debouncedSetViewState]
  );

  // Pan controls with bounds checking
  const handlePan = useCallback(
    (newPan: { x: number; y: number }) => {
      // Add basic bounds checking if needed
      debouncedSetViewState({ pan: newPan });
    },
    [debouncedSetViewState]
  );

  // Enhanced reset view
  const resetView = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: settings.defaultZoom,
      pan: { x: 0, y: 0 },
    }));

    // Clear measurements for current image if requested
    if (currentImage) {
      setMeasurements((prev) => ({
        ...prev,
        [currentImage.id]: [],
      }));

      if (settings.persistMeasurements) {
        StorageUtils.clearMeasurements(currentImage.id);
      }
    }
  }, [settings.defaultZoom, settings.persistMeasurements, currentImage]);

  // Enhanced measurement handling
  const updateMeasurements = useCallback(
    (imageId: string, newMeasurements: Measurement[]) => {
      setMeasurements((prev) => ({
        ...prev,
        [imageId]: newMeasurements,
      }));

      // Save measurements to localStorage if enabled
      if (settings.persistMeasurements) {
        StorageUtils.saveMeasurements(imageId, newMeasurements);
      }
    },
    [settings.persistMeasurements]
  );

  // Delete specific measurement
  const deleteMeasurement = useCallback(
    (imageId: string, measurementId: string) => {
      const imageMeasurements = measurements[imageId] || [];
      const updatedMeasurements = imageMeasurements.filter(
        (m) => m.id !== measurementId
      );
      updateMeasurements(imageId, updatedMeasurements);
    },
    [measurements, updateMeasurements]
  );

  // Enhanced keyboard shortcuts
  useEffect(() => {
    if (!settings.keyboardShortcuts || !containerRef.current) return;

    keyboardManager.clear(); // Clear existing shortcuts

    // Navigation shortcuts
    keyboardManager.register("arrowleft", goToPrevious);
    keyboardManager.register("arrowup", goToPrevious);
    keyboardManager.register("arrowright", goToNext);
    keyboardManager.register("arrowdown", goToNext);

    // View shortcuts
    keyboardManager.register("m", () =>
      debouncedSetViewState({ measureMode: !viewState.measureMode })
    );
    keyboardManager.register("r", () =>
      debouncedSetViewState({ showRuler: !viewState.showRuler })
    );
    keyboardManager.register("h", () =>
      debouncedSetViewState({ showUI: !viewState.showUI })
    );
    keyboardManager.register("f", () =>
      debouncedSetViewState({ fullscreen: !viewState.fullscreen })
    );

    // Zoom shortcuts
    keyboardManager.register("+", () => handleZoom(1.3));
    keyboardManager.register("=", () => handleZoom(1.3));
    keyboardManager.register("-", () => handleZoom(0.7));
    keyboardManager.register("0", resetView);

    // Mode shortcuts
    keyboardManager.register("escape", () =>
      debouncedSetViewState({ measureMode: false })
    );

    keyboardManager.activate(containerRef.current);

    return () => {
      keyboardManager.deactivate();
    };
  }, [
    settings.keyboardShortcuts,
    goToPrevious,
    goToNext,
    viewState.measureMode,
    viewState.showRuler,
    viewState.showUI,
    viewState.fullscreen,
    handleZoom,
    resetView,
    debouncedSetViewState,
  ]);

  // Preload initial images
  useEffect(() => {
    if (settings.autoPreload && filteredImages.length > 0) {
      throttledPreload(filteredImages, currentImageIndex);
    }
  }, [
    settings.autoPreload,
    filteredImages,
    currentImageIndex,
    throttledPreload,
  ]);

  // Settings update
  const updateSettings = useCallback(
    (newSettings: Partial<TurbineSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
  );

  // View state update
  const updateViewState = useCallback((newViewState: Partial<ViewState>) => {
    setViewState((prev) => ({ ...prev, ...newViewState }));
  }, []);

  // Export measurements
  const exportMeasurements = useCallback(
    (format: "csv" | "json" = "csv") => {
      if (!currentImage) return "";

      const imageMeasurements = measurements[currentImage.id] || [];
      return StorageUtils.exportMeasurements(
        imageMeasurements,
        currentImage,
        format
      );
    },
    [currentImage, measurements]
  );

  // Export all measurements
  const exportAllMeasurements = useCallback(
    (format: "csv" | "json" = "csv") => {
      const allMeasurementData = filteredImages
        .map((img) => ({
          image: img,
          measurements: measurements[img.id] || [],
        }))
        .filter((data) => data.measurements.length > 0);

      if (format === "json") {
        return JSON.stringify(
          {
            blade: currentFilter.blade,
            side: currentFilter.side,
            totalImages: filteredImages.length,
            imagesWithMeasurements: allMeasurementData.length,
            data: allMeasurementData,
            exportDate: new Date().toISOString(),
          },
          null,
          2
        );
      }

      // CSV format for all measurements
      const headers = [
        "Image Name",
        "Blade",
        "Side",
        "Altitude (m)",
        "Measurement ID",
        "Distance (m)",
        "Distance (cm)",
        "Start X",
        "Start Y",
        "End X",
        "End Y",
        "Absolute Altitude (m)",
        "Blade Percentage",
        "Created At",
      ];

      const rows: string[] = [];
      allMeasurementData.forEach(
        ({ image, measurements: imageMeasurements }) => {
          imageMeasurements.forEach((m) => {
            rows.push(
              [
                image.name,
                image.blade,
                image.side,
                (image.gsd?.flight_height || 0).toFixed(2),
                m.id,
                ((m.distance || 0) / 100).toFixed(4),
                (m.distance || 0).toFixed(2),
                m.start.x.toFixed(2),
                m.start.y.toFixed(2),
                m.end.x.toFixed(2),
                m.end.y.toFixed(2),
                m.absolutePosition?.altitude?.toFixed(2) || "",
                m.absolutePosition?.bladePercentage?.toFixed(1) || "",
                m.createdAt ? new Date(m.createdAt).toISOString() : "",
              ].join(",")
            );
          });
        }
      );

      return [headers.join(","), ...rows].join("\n");
    },
    [filteredImages, measurements, currentFilter]
  );

  // Clear all measurements
  const clearAllMeasurements = useCallback(() => {
    setMeasurements({});
    // Clear from localStorage
    filteredImages.forEach((img) => {
      StorageUtils.clearMeasurements(img.id);
    });
  }, [filteredImages]);

  // Clear measurements for current blade/side
  const clearBladeMeasurements = useCallback(() => {
    const clearedMeasurements = { ...measurements };
    filteredImages.forEach((img) => {
      delete clearedMeasurements[img.id];
      StorageUtils.clearMeasurements(img.id);
    });
    setMeasurements(clearedMeasurements);
  }, [measurements, filteredImages]);

  // Enhanced statistics
  const statistics = useMemo((): Statistics => {
    const totalMeasurements = Object.values(measurements).reduce(
      (sum, imageMeasurements) => sum + imageMeasurements.length,
      0
    );

    const averageMeasurements =
      filteredImages.length > 0 ? totalMeasurements / filteredImages.length : 0;

    const currentProgress =
      bladeContext?.currentImagePosition?.percentageFromBase || 0;

    return {
      totalImages: filteredImages.length,
      totalMeasurements,
      averageMeasurements: averageMeasurements.toFixed(1),
      currentImageMeasurements: currentImage
        ? (measurements[currentImage.id] || []).length
        : 0,
      bladeLength: bladeContext?.lengthMeters || 0,
      currentProgress,
    };
  }, [measurements, filteredImages, currentImage, bladeContext]);

  // Refresh data
  const refreshData = useCallback(async () => {
    try {
      PerformanceMonitor.startTimer("refresh");
      setIsLoading(true);
      setError(null);
      const images = await fetchTurbineData();
      setAllImages(images);

      // Reset current index if it's out of bounds
      const newFilteredImages = images.filter(
        (img) =>
          img.blade === currentFilter.blade && img.side === currentFilter.side
      );

      if (currentImageIndex >= newFilteredImages.length) {
        setCurrentImageIndex(0);
      }

      PerformanceMonitor.endTimer("refresh");
    } catch (err) {
      console.error("Failed to refresh turbine data:", err);
      setError("Failed to refresh turbine images");
    } finally {
      setIsLoading(false);
    }
  }, [currentFilter, currentImageIndex]);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      averageLoadTime: PerformanceMonitor.getAverageTime("data-load"),
      averageNavigationTime: PerformanceMonitor.getAverageTime("navigation"),
      cacheSize: imagePreloader.getCacheSize(),
      totalMeasurements: Object.values(measurements).flat().length,
    };
  }, [measurements]);

  return {
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
    navigateToAltitude,
    handleFilterChange,

    // View controls
    handleZoom,
    setZoom,
    handlePan,
    resetView,
    updateViewState,

    // Measurement controls
    updateMeasurements,
    deleteMeasurement,
    exportMeasurements,
    exportAllMeasurements,
    clearAllMeasurements,
    clearBladeMeasurements,

    // Settings
    updateSettings,

    // Utilities
    refreshData,
    getPerformanceMetrics,
    setIsLoading,
    setError,
  };
}
