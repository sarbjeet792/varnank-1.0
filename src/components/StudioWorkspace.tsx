import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StudioId,
  StudioToolDefinition,
  PresetDefinition,
  PlanDefinition,
  EntitlementState,
  ExportFormatCode,
  INITIAL_PLANS,
  evaluateDeviceMemoryGuard,
  validatePlanCapabilities,
} from '../core/engine';
import {
  CanvasRenderParams,
  renderStudioCanvas,
  exportCanvasAsLocalPdfBlob,
  exportCanvasAsLocalSvgBlob,
  createBrowserZipBlob,
} from '../core/browserProcessors';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Trash2,
  Upload,
  Camera,
  Lock,
  Sliders,
  RotateCw,
  Copy,
  Printer,
  Layers,
  Maximize2,
  Columns,
  LayoutGrid,
  CheckCircle2,
  Sparkles,
  FilePlus2,
  Activity,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export interface LocalActivityEntry {
  id: string;
  studioId: StudioId;
  studioName: string;
  toolName: string;
  presetCode: string;
  exportFormat: string;
  timestamp: string;
}

export interface ActiveExportProgressTask {
  active: boolean;
  taskLabel: string;
  stageLabel: string;
  progressPct: number;
  currentItem: number;
  totalItems: number;
  format: ExportFormatCode;
  dpi: number;
  qualityPct: number;
  elapsedMs: number;
}

interface QueuedLocalFile {
  id: string;
  name: string;
  sizeKb: string;
  image: HTMLImageElement;
}

interface StudioWorkspaceProps {
  studios: Array<{ id: StudioId; codeLabel: string; name: string; summary: string }>;
  tools: StudioToolDefinition[];
  presets: PresetDefinition[];
  userCustomPresets: PresetDefinition[];
  onSaveLocalPreset: (preset: PresetDefinition) => void;
  sessionToken: string | null;
  entitlementToken: string | null;
  activePlan?: PlanDefinition;
  entitlementState?: EntitlementState;
  initialPresetToApply?: PresetDefinition | null;
  onConsumedInitialPreset?: () => void;
  onRequestUpgrade: () => void;
  onRecordLocalActivity: (entry: LocalActivityEntry) => void;
  onWipeAllLocalData: () => void;
  defaultExportFormat?: 'PNG' | 'JPEG' | 'WEBP' | 'PDF';
  onDailyExportsCountChange?: (count: number) => void;
}

interface EditorSnapshot {
  widthPx: number;
  heightPx: number;
  titleText: string;
  subtitleText: string;
  codeLabel: string;
  rotationDeg: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  backgroundStyle: CanvasRenderParams['backgroundStyle'];
  showIdGuide: boolean;
  showPrintCropMarks: boolean;
  bleedMm: number;
  redactionBoxes: Array<{ xPct: number; yPct: number; wPct: number; hPct: number }>;
  idSheetCopies: 1 | 4 | 8 | 16;
  stampText: string;
}

const DEFAULT_SNAPSHOT: EditorSnapshot = {
  widthPx: 800,
  heightPx: 600,
  titleText: 'Varnank Visual Specification',
  subtitleText: 'Processed 100% on your device',
  codeLabel: 'Visual Frame',
  rotationDeg: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  backgroundStyle: 'WARM_PAPER',
  showIdGuide: false,
  showPrintCropMarks: false,
  bleedMm: 0,
  redactionBoxes: [],
  idSheetCopies: 1,
  stampText: '',
};

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  studios,
  tools,
  presets,
  userCustomPresets,
  onSaveLocalPreset,
  sessionToken,
  entitlementToken,
  activePlan = INITIAL_PLANS.NONE,
  entitlementState = 'NONE',
  initialPresetToApply = null,
  onConsumedInitialPreset,
  onRequestUpgrade,
  onRecordLocalActivity,
  onWipeAllLocalData,
  defaultExportFormat = 'PNG',
  onDailyExportsCountChange,
}) => {
  const [selectedStudioId, setSelectedStudioId] = useState<StudioId>('S1');
  const [selectedToolId, setSelectedToolId] = useState<string>('T1');
  const [toolTierFilter, setToolTierFilter] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [unlockedBundles, setUnlockedBundles] = useState<Record<string, boolean>>({});
  const [bundleStatusMessage, setBundleStatusMessage] = useState<string | null>(null);

  // Work Area layout, unit, and comparison options
  const [workspaceLayout, setWorkspaceLayout] = useState<'STANDARD' | 'WIDE_CANVAS' | 'SPLIT_COMPARE'>('STANDARD');
  const [displayUnit, setDisplayUnit] = useState<'px' | 'mm' | 'in'>('px');
  const [showRulerGuides, setShowRulerGuides] = useState<boolean>(false);
  const [showCustomSizeDrawer, setShowCustomSizeDrawer] = useState<boolean>(false);

  // Strict 3-files/day Free export counter persisted locally by UTC date
  const todayStorageKey = `varnank_daily_exports_${new Date().toISOString().slice(0, 10)}`;
  const [dailyExportsUsed, setDailyExportsUsed] = useState<number>(() => {
    try {
      return Math.max(0, Number(localStorage.getItem(todayStorageKey)) || 0);
    } catch {
      return 0;
    }
  });

  // Effective active plan caps (PENDING/REFUNDED/EXPIRED never get paid output caps)
  const effectivePlan =
    entitlementState === 'ACTIVE' || entitlementState === 'GRACE'
      ? activePlan
      : sessionToken
      ? INITIAL_PLANS.FREE
      : INITIAL_PLANS.NONE;

  // Evaluate current user plan capabilities (Free vs Paid) via validatePlanCapabilities(planId, studioId, actionType)
  const planCapabilities = validatePlanCapabilities(
    effectivePlan.id,
    selectedStudioId,
    'PREVIEW',
    {
      state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
      dailyExportsUsed,
      plansMap: {
        ...INITIAL_PLANS,
        [effectivePlan.id]: effectivePlan,
      },
    }
  );

  const isSubscriberActive = planCapabilities.isPaidTierActive;
  const [upgradePromptReason, setUpgradePromptReason] = useState<string | null>(null);
  const [postSavePrompt, setPostSavePrompt] = useState<{
    filename: string;
    actionLabel: string;
    wasSampleWatermarked: boolean;
    qualityPct: number;
    dpi: number;
    dailyUsedAfterSave: number;
  } | null>(null);

  const promptUpgradeForCapability = useCallback((message: string) => {
    setUpgradePromptReason(message);
    setBundleStatusMessage(message);
    setStatusFeedback(message);
  }, []);

  // 20-step Undo/Redo Stack (Category G)
  const [history, setHistory] = useState<EditorSnapshot[]>([DEFAULT_SNAPSHOT]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const currentSnap = history[historyIndex] || DEFAULT_SNAPSHOT;

  // Single + Multi-file Local Batch Queue in Browser RAM
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [loadedFileLabel, setLoadedFileLabel] = useState<string | null>(null);
  const [batchQueue, setBatchQueue] = useState<QueuedLocalFile[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [isExploringSampleMode, setIsExploringSampleMode] = useState<boolean>(false);

  // Dynamic & progressive session activity counters (never static/predefined)
  const [sessionTaskCount, setSessionTaskCount] = useState<number>(0);
  const [sessionExportsCompleted, setSessionExportsCompleted] = useState<number>(0);
  const [loadedSourceBytes, setLoadedSourceBytes] = useState<number>(0);
  const [activeWorkspaceZone, setActiveWorkspaceZone] = useState<
    'TOOLS' | 'WORK_AREA' | 'ADJUSTMENTS' | 'EXPORT'
  >('WORK_AREA');

  // Visual progress indicator state for active browser-side export tasks
  const [exportProgressTask, setExportProgressTask] = useState<ActiveExportProgressTask | null>(
    null
  );

  // Progressive working buffer usage % computed dynamically from undo stack, batch queue, canvas pixel density, and source bytes
  const canvasPixelLoadPct = Math.min(
    25,
    Math.round(
      ((currentSnap.widthPx * currentSnap.heightPx) /
        Math.max(1, planCapabilities.maxResolutionPx * planCapabilities.maxResolutionPx)) *
        25
    )
  );
  const sourceMemoryLoadPct = Math.min(
    25,
    Math.round((loadedSourceBytes / (8 * 1024 * 1024)) * 25) + (sourceImage ? 8 : 0)
  );
  const workingBufferUsagePct = Math.min(
    100,
    Math.max(
      Math.round(((history.length - 1) / 19) * 100),
      Math.round(
        ((history.length - 1) / 19) * 45 +
          (batchQueue.length / Math.max(1, planCapabilities.batchLimit)) * 35 +
          canvasPixelLoadPct +
          sourceMemoryLoadPct
      )
    )
  );

  const [ramWarning, setRamWarning] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormatCode>(defaultExportFormat);
  const [exportQualityPct, setExportQualityPct] = useState<number>(planCapabilities.quality);
  const [exportDpi, setExportDpi] = useState<number>(planCapabilities.dpi);
  const [batchCount, setBatchCount] = useState<number>(
    Math.min(4, Math.max(1, planCapabilities.batchLimit))
  );
  const [targetKbLimit, setTargetKbLimit] = useState<number>(50);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [lastExportResult, setLastExportResult] = useState<{
    filename: string;
    format: ExportFormatCode;
    qualityPct: number;
    dpi: number;
    dimensions: string;
    quantityLabel: string;
    tierLabel: string;
    sizeKb: string;
  } | null>(null);
  const [customPresetName, setCustomPresetName] = useState<string>('');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);

  // Dynamic progressive calculation of live canvas megapixels and estimated output size (KB)
  const canvasMegapixels = ((currentSnap.widthPx * currentSnap.heightPx) / 1_000_000).toFixed(2);
  const estimatedOutputKb = Math.max(
    12,
    Math.round(
      ((currentSnap.widthPx * currentSnap.heightPx) / 1024) *
        (exportQualityPct / 100) *
        (exportDpi / 150) *
        (exportFormat === 'PNG'
          ? 0.42
          : exportFormat === 'JPEG'
          ? 0.18
          : exportFormat === 'WEBP'
          ? 0.14
          : exportFormat === 'PDF'
          ? 0.35
          : exportFormat === 'SVG'
          ? 0.12
          : Math.max(1, batchCount) * 0.32) *
        (selectedToolId === 'T21' ? targetKbLimit / 100 : 1)
    )
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Immediate go-to / move-to work area or task section once a linked button is pressed
  const moveToWorkspaceSection = useCallback(
    (
      sectionId:
        | 'studio-tools-section'
        | 'studio-work-area-section'
        | 'studio-adjustments-section'
        | 'studio-export-section',
      zoneKey?: 'TOOLS' | 'WORK_AREA' | 'ADJUSTMENTS' | 'EXPORT'
    ) => {
      if (zoneKey) {
        setActiveWorkspaceZone(zoneKey);
      }
      setSessionTaskCount((c) => c + 1);
      if (typeof document !== 'undefined') {
        const el = document.getElementById(sectionId);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },
    []
  );

  const studioTools = tools.filter((t) => {
    if (t.studioId !== selectedStudioId || t.enabled === false) return false;
    if (toolTierFilter === 'FREE') return t.tier === 'FREE';
    if (toolTierFilter === 'PAID') return t.tier !== 'FREE';
    return true;
  });

  const activeTool =
    tools.find((t) => t.id === selectedToolId && t.studioId === selectedStudioId) ||
    tools.find((t) => t.studioId === selectedStudioId && t.enabled !== false) ||
    tools[0];

  // Contextual presets: ONLY return presets that belong to a specific tool (never forced where not needed)
  const getContextualPresetsForTool = useCallback(
    (toolId: string) => {
      return [...presets, ...userCustomPresets].filter(
        (p) =>
          p.studioId === selectedStudioId &&
          Array.isArray(p.applicableToolIds) &&
          p.applicableToolIds.includes(toolId)
      );
    },
    [presets, userCustomPresets, selectedStudioId]
  );

  // Convert pixels to active display unit (px, mm, or in) based on current exportDpi
  const formatDimensionInUnit = (px: number): string => {
    const safeDpi = Math.max(72, exportDpi);
    if (displayUnit === 'mm') {
      return `${Math.round((px * 25.4) / safeDpi)} mm`;
    }
    if (displayUnit === 'in') {
      return `${((px / safeDpi) * 1).toFixed(2)} in`;
    }
    return `${px} px`;
  };

  const pushSnapshot = useCallback(
    (updater: (prev: EditorSnapshot) => EditorSnapshot) => {
      setSessionTaskCount((c) => c + 1);
      setHistory((prevHist) => {
        const base = prevHist[prevHist.length - 1] || DEFAULT_SNAPSHOT;
        const nextSnap = updater(base);
        const appended = [...prevHist, nextSnap];
        if (appended.length > 20) appended.shift();
        setHistoryIndex(appended.length - 1);
        return appended;
      });
    },
    []
  );

  // Automatic memory wipe when leaving ID/Govt. ID Studio (S3) per Decision Log G1
  const switchStudio = (nextStudioId: StudioId) => {
    if (selectedStudioId === 'S3' && nextStudioId !== 'S3') {
      setSourceImage(null);
      setLoadedFileLabel(null);
      setBatchQueue([]);
      setActiveQueueId(null);
      setStatusFeedback('ID Studio temporary memory buffer automatically wiped on close.');
    }

    setSelectedStudioId(nextStudioId);
    const firstTool = tools.find((t) => t.studioId === nextStudioId && t.enabled !== false);
    if (firstTool) setSelectedToolId(firstTool.id);
    setShowCustomSizeDrawer(false);

    const defaultsByStudio: Record<StudioId, Partial<EditorSnapshot>> = {
      S1: {
        widthPx: 800,
        heightPx: 600,
        codeLabel: 'Visual Frame',
        titleText: 'Varnank Visual Frame',
        subtitleText: 'Processed locally on your device',
        backgroundStyle: 'WARM_PAPER',
        showIdGuide: false,
        showPrintCropMarks: false,
        idSheetCopies: 1,
      },
      S2: {
        widthPx: 720,
        heightPx: 960,
        codeLabel: 'Document Sheet',
        titleText: 'Document Specification Sheet',
        subtitleText: 'Multi-page & redaction workspace',
        backgroundStyle: 'PURE_WHITE',
        showIdGuide: false,
        showPrintCropMarks: false,
        idSheetCopies: 1,
      },
      S3: {
        widthPx: 413,
        heightPx: 531,
        codeLabel: 'Passport Size (35×45mm)',
        titleText: 'ID Dimension Alignment',
        subtitleText: 'Auto-wipes temporary buffer on close',
        backgroundStyle: 'LIGHT_BLUE_ID',
        showIdGuide: true,
        showPrintCropMarks: false,
        idSheetCopies: 1,
      },
      S4: {
        widthPx: 840,
        heightPx: 600,
        codeLabel: 'Publication Layout',
        titleText: 'Publication Layout Card',
        subtitleText: 'Archival Press Edition',
        backgroundStyle: 'WARM_PAPER',
        showIdGuide: false,
        showPrintCropMarks: false,
        idSheetCopies: 1,
      },
    };

    const nextSnap: EditorSnapshot = {
      ...DEFAULT_SNAPSHOT,
      ...defaultsByStudio[nextStudioId],
    };
    setHistory([nextSnap]);
    setHistoryIndex(0);
    setBundleStatusMessage(null);
    moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
  };

  // Allow Free & Freemium users to check, analyze, and explore Paid/Premium tools in Watermarked Sample Mode
  const handleSelectTool = async (tool: StudioToolDefinition) => {
    setSelectedToolId(tool.id);
    setBundleStatusMessage(null);
    setShowCustomSizeDrawer(false);
    moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');

    if (tool.tier === 'FREE' || !tool.bundleId) {
      return;
    }

    if (!sessionToken || !entitlementToken) {
      setIsExploringSampleMode(true);
      setBundleStatusMessage(
        `Exploring "${tool.name}" in Free Watermarked Sample Mode (capped at ${planCapabilities.quality}% quality · ${planCapabilities.dpi} DPI · 1 file). You can test and save a watermarked sample to your device, or subscribe to unlock full 300–600 DPI unwatermarked output.`
      );
      return;
    }

    try {
      const resp = await fetch(`/api/entitlements/bundle/${tool.bundleId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'X-Entitlement-Token': entitlementToken,
        },
      });
      const data = await resp.json();
      if (resp.ok && data.unlocked) {
        setUnlockedBundles((prev) => ({ ...prev, [tool.bundleId!]: true }));
        setIsExploringSampleMode(false);
        setBundleStatusMessage('Paid tool bundle verified and loaded into browser memory.');
      } else {
        setUnlockedBundles((prev) => ({ ...prev, [tool.bundleId!]: false }));
        setIsExploringSampleMode(true);
        setBundleStatusMessage(
          `Exploring "${tool.name}" in Freemium Watermarked Sample Mode (capped at ${planCapabilities.quality}% quality · ${planCapabilities.dpi} DPI). Subscribe to unlock full unwatermarked output.`
        );
      }
    } catch {
      setIsExploringSampleMode(true);
      setBundleStatusMessage('Exploring tool in offline watermarked sample mode.');
    }
  };

  // Sync unlocked bundle status whenever sessionToken, entitlementToken, or selectedStudioId changes
  useEffect(() => {
    let cancelled = false;
    const syncStudioBundles = async () => {
      if (!sessionToken || !entitlementToken) {
        setUnlockedBundles({});
        return;
      }
      const paidTools = tools.filter((t) => t.studioId === selectedStudioId && t.bundleId);
      const nextMap: Record<string, boolean> = {};
      for (const t of paidTools) {
        try {
          const resp = await fetch(`/api/entitlements/bundle/${t.bundleId}`, {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              'X-Entitlement-Token': entitlementToken,
            },
          });
          const data = await resp.json();
          nextMap[t.bundleId!] = Boolean(resp.ok && data.unlocked);
        } catch {
          nextMap[t.bundleId!] = false;
        }
      }
      if (!cancelled) {
        setUnlockedBundles((prev) => ({ ...prev, ...nextMap }));
      }
    };
    syncStudioBundles();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, entitlementToken, selectedStudioId, tools]);

  const isCurrentToolLocked =
    activeTool &&
    activeTool.tier !== 'FREE' &&
    (!activeTool.bundleId || !unlockedBundles[activeTool.bundleId]) &&
    !(
      effectivePlan.unlocksPaidBundles &&
      (activeTool.tier === 'PAID' ||
        (activeTool.tier === 'PREMIUM' && effectivePlan.unlocksPremiumAutomation))
    );

  // Whether current canvas uses any Paid/Premium feature or Sample Mode on a Free/Freemium plan
  const isUsingWatermarkedSampleFeatures =
    !isSubscriberActive &&
    (Boolean(isCurrentToolLocked) ||
      isExploringSampleMode ||
      currentSnap.idSheetCopies > 1 ||
      currentSnap.redactionBoxes.length > 0 ||
      currentSnap.showPrintCropMarks ||
      Boolean(currentSnap.stampText.trim()));

  // Re-render canvas locally whenever snapshot, sourceImage, or layout changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const effectiveStampText = isUsingWatermarkedSampleFeatures
      ? currentSnap.stampText.trim()
        ? `${currentSnap.stampText.trim()} · SAMPLE PREVIEW (72 DPI CAP)`
        : 'SAMPLE PREVIEW · FREE TIER CAPPED (72 DPI / 80%) · SUBSCRIBE FOR PRO'
      : currentSnap.stampText;

    renderStudioCanvas(canvasRef.current, {
      studioId: selectedStudioId,
      toolId: selectedToolId,
      ...currentSnap,
      stampText: effectiveStampText,
      sourceImage,
    });

    if (workspaceLayout === 'SPLIT_COMPARE' && compareOriginalCanvasRef.current) {
      renderStudioCanvas(compareOriginalCanvasRef.current, {
        studioId: selectedStudioId,
        toolId: selectedToolId,
        ...DEFAULT_SNAPSHOT,
        widthPx: currentSnap.widthPx,
        heightPx: currentSnap.heightPx,
        codeLabel: 'Original Input',
        titleText: 'Original Unmodified Input',
        subtitleText: 'Before Studio Adjustments',
        backgroundStyle: 'PURE_WHITE',
        sourceImage,
      });
    }
  }, [selectedStudioId, selectedToolId, currentSnap, sourceImage, workspaceLayout]);

  // Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y) & Clipboard Paste (Ctrl+V)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        setHistoryIndex((i) => Math.max(0, i - 1));
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) handleLocalFileLoad(blob);
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [history.length]);

  const handleLocalFileLoad = (file: File) => {
    setRamWarning(null);
    const guard = evaluateDeviceMemoryGuard({
      fileSizeBytes: file.size,
      pageOrBatchCount: 1,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      isMobileViewport: window.innerWidth < 768,
    });

    if (!guard.safe) {
      setRamWarning(guard.plainWarning);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const entryId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const sizeKb = (file.size / 1024).toFixed(1);
        setSourceImage(img);
        setLoadedSourceBytes(file.size);
        setLoadedFileLabel(`${file.name} (${sizeKb} KB · Local RAM)`);
        setBatchQueue((prev) => [{ id: entryId, name: file.name, sizeKb, image: img }, ...prev.slice(0, 99)]);
        setActiveQueueId(entryId);
        setStatusFeedback('File loaded into browser memory. Zero bytes sent over network.');
        moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBatchFilesLoad = (fileList: FileList) => {
    setRamWarning(null);
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const totalBytes = filesArray.reduce((acc, f) => acc + f.size, 0);
    const guard = evaluateDeviceMemoryGuard({
      fileSizeBytes: totalBytes,
      pageOrBatchCount: filesArray.length,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      isMobileViewport: window.innerWidth < 768,
    });

    if (!guard.safe) {
      setRamWarning(guard.plainWarning);
      return;
    }

    const batchCheck = validatePlanCapabilities(
      effectivePlan.id,
      selectedStudioId,
      'BATCH_EXPORT',
      {
        state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
        requestedBatchCount: filesArray.length,
        dailyExportsUsed,
        plansMap: {
          ...INITIAL_PLANS,
          [effectivePlan.id]: effectivePlan,
        },
      }
    );
    const maxAllowed = batchCheck.batchLimit;
    const clampedFiles = filesArray.slice(0, Math.max(1, maxAllowed));

    clampedFiles.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const entryId = `Q-${Date.now()}-${idx}`;
          const sizeKb = (file.size / 1024).toFixed(1);
          setBatchQueue((prev) => [...prev, { id: entryId, name: file.name, sizeKb, image: img }]);
          if (idx === 0) {
            setSourceImage(img);
            setActiveQueueId(entryId);
            setLoadedFileLabel(
              `${clampedFiles.length} file(s) staged in Local Batch Queue (Active: ${file.name})`
            );
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

    setLoadedSourceBytes(totalBytes);
    setBatchCount(Math.min(batchCheck.batchLimit, Math.max(1, clampedFiles.length)));
    moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
    if (!batchCheck.allowed || filesArray.length > maxAllowed) {
      promptUpgradeForCapability(
        `Loaded ${maxAllowed} file into queue (${batchCheck.effectivePlanName} batch limit is ${maxAllowed} file; subscribe to a Paid Plan to unlock 25–100+ batch file limits).`
      );
    } else {
      setStatusFeedback(`Loaded ${clampedFiles.length} file(s) into local memory queue.`);
    }
  };

  // Load interactive studio sample so Free & Freemium users can check, analyze & explore paid/free features
  const handleLoadInteractiveSample = () => {
    setSourceImage(null);
    setIsExploringSampleMode(!isSubscriberActive);
    const sampleByStudio: Record<StudioId, Partial<EditorSnapshot>> = {
      S1: {
        widthPx: 1200,
        heightPx: 900,
        codeLabel: 'Sample Visual Frame',
        titleText: 'Archival Visual Sample Specification',
        subtitleText: isSubscriberActive
          ? '300 DPI Lossless Studio Sample'
          : 'Watermarked Sample Preview · Capped at 72 DPI / 80% Quality',
        backgroundStyle: 'WARM_PAPER',
        showPrintCropMarks: true,
      },
      S2: {
        widthPx: 840,
        heightPx: 1188,
        codeLabel: 'Sample Document Brief',
        titleText: 'Compliance & Redaction Sample Document',
        subtitleText: isSubscriberActive
          ? '300 DPI Redaction Ready'
          : 'Watermarked Sample Preview · Capped at 72 DPI / 80% Quality',
        backgroundStyle: 'PURE_WHITE',
        redactionBoxes: [{ xPct: 14, yPct: 54, wPct: 52, hPct: 8 }],
      },
      S3: {
        widthPx: 800,
        heightPx: 1120,
        codeLabel: 'Sample 4-Up ID Sheet',
        titleText: 'Multi-Copy ID Print Sheet Sample',
        subtitleText: isSubscriberActive
          ? '300 DPI Official ID Sheet'
          : 'Watermarked 4-Up Sample · Capped at 72 DPI / 80% Quality',
        backgroundStyle: 'LIGHT_BLUE_ID',
        idSheetCopies: 4,
        showIdGuide: false,
      },
      S4: {
        widthPx: 1200,
        heightPx: 800,
        codeLabel: 'Sample Press Layout',
        titleText: 'Publication Broadsheet & Bleed Sample',
        subtitleText: isSubscriberActive
          ? '300 DPI Press Proof with 3mm Bleed'
          : 'Watermarked Press Sample · Capped at 72 DPI / 80% Quality',
        backgroundStyle: 'WARM_PAPER',
        showPrintCropMarks: true,
        bleedMm: 3,
      },
    };
    pushSnapshot((prev) => ({
      ...prev,
      ...sampleByStudio[selectedStudioId],
    }));
    setLoadedFileLabel(
      isSubscriberActive
        ? 'Pro Studio Sample Loaded (Full Resolution)'
        : 'Watermarked Studio Sample Loaded (Explore Paid & Free Features)'
    );
    setStatusFeedback(
      isSubscriberActive
        ? 'Loaded interactive studio sample at full subscriber resolution.'
        : 'Loaded watermarked studio sample! You can analyze Paid & Free features and save up to 3 capped sample files/day to your device.'
    );
    moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
  };

  const applyPreset = useCallback(
    (preset: PresetDefinition) => {
      const anyPaidUnlocked =
        planCapabilities.featureAccess.paidTools ||
        Object.values(unlockedBundles).some(Boolean);

      if (preset.tier === 'PAID' && !anyPaidUnlocked) {
        setIsExploringSampleMode(true);
        setBundleStatusMessage(
          `Exploring Paid preset "${preset.name}" (${preset.dimensionsLabel}) in Watermarked Sample Mode (capped at ${planCapabilities.quality}% quality · ${planCapabilities.dpi} DPI). Save a sample to inspect or subscribe to unlock full 300–600 DPI output.`
        );
      }

      const maxPx = planCapabilities.maxResolutionPx || 1600;
      const clampedW = Math.min(maxPx, preset.widthPx);
      const clampedH = Math.min(maxPx, preset.heightPx);
      const nextCopies: 1 | 4 | 8 | 16 =
        preset.id === 'P10'
          ? anyPaidUnlocked
            ? 16
            : 4
          : preset.id === 'P4'
          ? anyPaidUnlocked
            ? 8
            : 4
          : 1;

      pushSnapshot((prev) => ({
        ...prev,
        widthPx: clampedW,
        heightPx: clampedH,
        codeLabel: preset.codeLabel,
        bleedMm: preset.bleedMm,
        showPrintCropMarks: preset.bleedMm > 0,
        idSheetCopies: preset.studioId === 'S3' ? nextCopies : 1,
      }));
      setExportDpi(
        anyPaidUnlocked
          ? Math.min(planCapabilities.maxExportDpi, preset.dpi)
          : planCapabilities.dpi
      );
      setStatusFeedback(
        preset.tier === 'PAID' && !anyPaidUnlocked
          ? `Applied "${preset.name}" in Watermarked Sample Mode (${planCapabilities.dpi} DPI · ${planCapabilities.quality}% quality cap).`
          : `Applied ${preset.codeLabel}: ${preset.name}`
      );
      moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
    },
    [planCapabilities, unlockedBundles, pushSnapshot, moveToWorkspaceSection]
  );

  // Sync output quality, DPI, format, and batch caps whenever planCapabilities changes
  useEffect(() => {
    setExportQualityPct((prev) => Math.min(prev, planCapabilities.maxExportQualityPct));
    setExportDpi((prev) => Math.min(prev, planCapabilities.maxExportDpi));
    setBatchCount((prev) => Math.min(Math.max(1, prev), planCapabilities.batchLimit));
    if (!planCapabilities.allowedFormats.includes(exportFormat)) {
      setExportFormat(planCapabilities.allowedFormats[0] || 'PNG');
    }
  }, [planCapabilities, exportFormat]);

  // Apply preset if passed externally
  useEffect(() => {
    if (!initialPresetToApply) return;
    setSelectedStudioId(initialPresetToApply.studioId);
    const matchingToolId =
      initialPresetToApply.applicableToolIds?.[0] ||
      tools.find((t) => t.studioId === initialPresetToApply.studioId && t.enabled !== false)?.id;
    if (matchingToolId) setSelectedToolId(matchingToolId);
    applyPreset(initialPresetToApply);
    if (onConsumedInitialPreset) onConsumedInitialPreset();
  }, [initialPresetToApply, tools, applyPreset, onConsumedInitialPreset]);

  const handleCloseAndWipeCurrentBuffer = () => {
    setSourceImage(null);
    setLoadedSourceBytes(0);
    setLoadedFileLabel(null);
    setBatchQueue([]);
    setActiveQueueId(null);
    setIsExploringSampleMode(false);
    setLastExportResult(null);
    setExportProgressTask(null);
    setHistory([DEFAULT_SNAPSHOT]);
    setHistoryIndex(0);
    if (canvasRef.current) {
      renderStudioCanvas(canvasRef.current, {
        studioId: selectedStudioId,
        toolId: selectedToolId,
        ...DEFAULT_SNAPSHOT,
        sourceImage: null,
      });
    }
    setStatusFeedback('Temporary working buffer, batch queue, and undo stack wiped from browser memory.');
  };

  const incrementLocalDailyExportCounter = (): number => {
    const nextUsed = dailyExportsUsed + 1;
    setDailyExportsUsed(nextUsed);
    setSessionExportsCompleted((c) => c + 1);
    setSessionTaskCount((c) => c + 1);
    if (onDailyExportsCountChange) {
      onDailyExportsCountChange(nextUsed);
    }
    try {
      localStorage.setItem(todayStorageKey, String(nextUsed));
    } catch {
      // ignore storage quota errors
    }
    return nextUsed;
  };

  const pauseForProgressFrame = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const recordFileTransferAndPromptSubscription = (
    filename: string,
    actionLabel: string,
    appliedQuality: number,
    appliedDpi: number,
    nextDailyUsed: number
  ) => {
    if (!isSubscriberActive) {
      setPostSavePrompt({
        filename,
        actionLabel,
        wasSampleWatermarked: isUsingWatermarkedSampleFeatures,
        qualityPct: appliedQuality,
        dpi: appliedDpi,
        dailyUsedAfterSave: nextDailyUsed,
      });
    } else {
      setPostSavePrompt({
        filename,
        actionLabel,
        wasSampleWatermarked: false,
        qualityPct: appliedQuality,
        dpi: appliedDpi,
        dailyUsedAfterSave: nextDailyUsed,
      });
    }
  };

  const handleExportOutput = async () => {
    if (!canvasRef.current) return;
    const startTs = Date.now();

    const requestedBatch =
      exportFormat === 'ZIP' ? Math.max(batchCount, batchQueue.length || 2) : 1;

    // For Free/Freemium users exploring paid features/samples, allow export with sample watermark & quality/DPI/quantity caps
    const effectiveRequestedQuality = isSubscriberActive
      ? exportQualityPct
      : Math.min(exportQualityPct, planCapabilities.maxExportQualityPct);
    const effectiveRequestedDpi = isSubscriberActive
      ? exportDpi
      : Math.min(exportDpi, planCapabilities.maxExportDpi);

    setExportProgressTask({
      active: true,
      taskLabel:
        exportFormat === 'ZIP'
          ? `Batch ZIP Export (${requestedBatch} items)`
          : `${exportFormat} Studio Export`,
      stageLabel: 'Stage 1/4 · Validating plan capabilities & daily quota...',
      progressPct: 18,
      currentItem: 1,
      totalItems: requestedBatch,
      format: exportFormat,
      dpi: effectiveRequestedDpi,
      qualityPct: effectiveRequestedQuality,
      elapsedMs: Date.now() - startTs,
    });
    await pauseForProgressFrame(80);

    const capabilityCheck = validatePlanCapabilities(
      effectivePlan.id,
      selectedStudioId,
      requestedBatch > 1 ? 'BATCH_EXPORT' : 'EXPORT',
      {
        state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
        requestedFormat: exportFormat,
        requestedQualityPct: effectiveRequestedQuality,
        requestedDpi: effectiveRequestedDpi,
        requestedBatchCount: requestedBatch,
        requestedWidthPx: currentSnap.widthPx,
        requestedHeightPx: currentSnap.heightPx,
        requestedIdSheetCopies: currentSnap.idSheetCopies,
        requestedToolTier: activeTool?.tier || 'FREE',
        isSelectedToolUnlocked: !isCurrentToolLocked,
        dailyExportsUsed,
        allowWatermarkedSampleExport: true,
        plansMap: {
          ...INITIAL_PLANS,
          [effectivePlan.id]: effectivePlan,
        },
      }
    );

    if (!capabilityCheck.allowed) {
      setExportProgressTask(null);
      promptUpgradeForCapability(capabilityCheck.reason);
      return;
    }

    // Check daily export allowance & server-side output cap verification on Control Plane (zero file bytes sent)
    try {
      const resp = await fetch('/api/entitlements/record-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          format: exportFormat,
          qualityPct: capabilityCheck.clampedQualityPct,
          dpi: capabilityCheck.clampedDpi,
          batchCount: requestedBatch,
          clientDailyUsed: dailyExportsUsed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.allowed) {
        setExportProgressTask(null);
        promptUpgradeForCapability(
          data.error || 'Strict 3 files/day Free export limit reached. Subscribe to a Paid Plan for unlimited exports.'
        );
        return;
      }
    } catch {
      // Offline fallback still enforces local dailyExportsUsed check via validatePlanCapabilities above
    }

    const studioMeta = studios.find((s) => s.id === selectedStudioId);
    const filenameBase = `varnank-${selectedStudioId.toLowerCase()}-${currentSnap.codeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}${isUsingWatermarkedSampleFeatures ? '-sample' : ''}`;

    const appliedQuality = isUsingWatermarkedSampleFeatures
      ? Math.min(capabilityCheck.clampedQualityPct, planCapabilities.quality)
      : capabilityCheck.clampedQualityPct;
    const appliedDpi = isUsingWatermarkedSampleFeatures
      ? Math.min(capabilityCheck.clampedDpi, planCapabilities.dpi)
      : capabilityCheck.clampedDpi;

    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            stageLabel: `Stage 2/4 · Rasterizing ${currentSnap.widthPx}×${currentSnap.heightPx}px canvas buffer...`,
            progressPct: 48,
            dpi: appliedDpi,
            qualityPct: appliedQuality,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );
    await pauseForProgressFrame(90);

    let blob: Blob | null = null;
    let ext = exportFormat.toLowerCase();
    // Respect Strict KB Target Compressor tool (T21) if active
    const effectiveQualityRatio =
      selectedToolId === 'T21'
        ? Math.min(0.85, Math.max(0.45, targetKbLimit / 100))
        : Math.min(1, Math.max(0.5, appliedQuality / 100));

    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            stageLabel: `Stage 3/4 · Encoding ${exportFormat} (${appliedQuality}% quality · ${appliedDpi} DPI)...`,
            progressPct: 78,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );
    await pauseForProgressFrame(90);

    if (exportFormat === 'PDF') {
      blob = await exportCanvasAsLocalPdfBlob(
        canvasRef.current,
        appliedQuality,
        appliedDpi
      );
      ext = 'pdf';
    } else if (exportFormat === 'SVG') {
      blob = exportCanvasAsLocalSvgBlob(
        canvasRef.current,
        currentSnap.codeLabel,
        appliedDpi
      );
      ext = 'svg';
    } else if (exportFormat === 'ZIP') {
      const dataUrl = canvasRef.current.toDataURL('image/png', effectiveQualityRatio);
      const b64 = dataUrl.split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const batchFiles: Array<{ name: string; data: Uint8Array }> = [];
      for (let idx = 0; idx < requestedBatch; idx++) {
        setExportProgressTask((prev) =>
          prev
            ? {
                ...prev,
                currentItem: idx + 1,
                stageLabel: `Stage 3/4 · Packaging batch item ${idx + 1} of ${requestedBatch}...`,
                progressPct: Math.min(94, 65 + Math.round(((idx + 1) / requestedBatch) * 28)),
                elapsedMs: Date.now() - startTs,
              }
            : null
        );
        batchFiles.push({
          name: `${filenameBase}-item-${idx + 1}.png`,
          data: bytes,
        });
      }
      blob = createBrowserZipBlob(batchFiles);
      ext = 'zip';
    } else {
      const mime =
        exportFormat === 'JPEG'
          ? 'image/jpeg'
          : exportFormat === 'WEBP'
          ? 'image/webp'
          : 'image/png';
      blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob((b) => resolve(b), mime, effectiveQualityRatio)
      );
    }

    if (!blob) {
      setExportProgressTask(null);
      return;
    }

    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            active: false,
            stageLabel: `Complete · Transferred ${filenameBase}.${ext} to device (${Date.now() - startTs} ms)`,
            progressPct: 100,
            currentItem: requestedBatch,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    const nextDailyUsed = incrementLocalDailyExportCounter();
    const blobSizeKb = (blob.size / 1024).toFixed(1);
    const quantityDesc =
      exportFormat === 'ZIP'
        ? `${requestedBatch} Batch Files in ZIP`
        : selectedStudioId === 'S3' && currentSnap.idSheetCopies > 1
        ? `${currentSnap.idSheetCopies}-Up Multi-Copy ID Sheet${
            isUsingWatermarkedSampleFeatures ? ' (Watermarked Sample)' : ''
          }`
        : isUsingWatermarkedSampleFeatures
        ? 'Single File (Watermarked Sample)'
        : 'Single File Output';

    setLastExportResult({
      filename: `${filenameBase}.${ext}`,
      format: exportFormat,
      qualityPct: appliedQuality,
      dpi: appliedDpi,
      dimensions: `${currentSnap.widthPx} × ${currentSnap.heightPx} px (${formatDimensionInUnit(
        currentSnap.widthPx
      )} × ${formatDimensionInUnit(currentSnap.heightPx)})`,
      quantityLabel: quantityDesc,
      tierLabel: isSubscriberActive
        ? `Paid Subscriber Output (${effectivePlan.name})`
        : `Free Capped Output (${nextDailyUsed}/${planCapabilities.dailyFreeLimit} daily files used)`,
      sizeKb: `${blobSizeKb} KB`,
    });

    onRecordLocalActivity({
      id: `ACT-${Date.now()}`,
      studioId: selectedStudioId,
      studioName: studioMeta?.name || selectedStudioId,
      toolName: activeTool?.name || 'Studio Export',
      presetCode: currentSnap.codeLabel,
      exportFormat: `${exportFormat} (${appliedQuality}% · ${appliedDpi} DPI · ${quantityDesc})`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    recordFileTransferAndPromptSubscription(
      `${filenameBase}.${ext}`,
      'Saved to Device',
      appliedQuality,
      appliedDpi,
      nextDailyUsed
    );

    setStatusFeedback(
      `Saved ${filenameBase}.${ext} (${blobSizeKb} KB · ${appliedQuality}% quality · ${appliedDpi} DPI · ${quantityDesc}) to your device.`
    );
  };

  const handleCopyCanvasToClipboard = async () => {
    if (!canvasRef.current) return;
    const startTs = Date.now();
    setExportProgressTask({
      active: true,
      taskLabel: 'Copy PNG to Device Clipboard',
      stageLabel: 'Stage 1/3 · Checking plan capabilities...',
      progressPct: 25,
      currentItem: 1,
      totalItems: 1,
      format: 'PNG',
      dpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
      qualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
      elapsedMs: 0,
    });
    await pauseForProgressFrame(60);

    const capabilityCheck = validatePlanCapabilities(
      effectivePlan.id,
      selectedStudioId,
      'EXPORT',
      {
        state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
        requestedFormat: 'PNG',
        requestedQualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
        requestedDpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
        requestedBatchCount: 1,
        dailyExportsUsed,
        allowWatermarkedSampleExport: true,
        plansMap: {
          ...INITIAL_PLANS,
          [effectivePlan.id]: effectivePlan,
        },
      }
    );
    if (!capabilityCheck.allowed) {
      setExportProgressTask(null);
      promptUpgradeForCapability(capabilityCheck.reason);
      return;
    }

    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            stageLabel: 'Stage 2/3 · Encoding PNG buffer for device clipboard...',
            progressPct: 70,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );
    await pauseForProgressFrame(60);

    const nextDailyUsed = incrementLocalDailyExportCounter();
    recordFileTransferAndPromptSubscription(
      `varnank-${selectedStudioId.toLowerCase()}.png`,
      'Copied to Device Clipboard',
      capabilityCheck.clampedQualityPct,
      capabilityCheck.clampedDpi,
      nextDailyUsed
    );

    canvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        setExportProgressTask(null);
        return;
      }
      try {
        if (navigator.clipboard && 'ClipboardItem' in window) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setStatusFeedback('Copied rendered studio output to your device clipboard.');
        } else {
          setStatusFeedback('Prepared clipboard image output on your device.');
        }
      } catch {
        setStatusFeedback('Prepared clipboard output on your device.');
      }
      setExportProgressTask((prev) =>
        prev
          ? {
              ...prev,
              active: false,
              stageLabel: `Complete · Copied PNG to clipboard (${Date.now() - startTs} ms)`,
              progressPct: 100,
              elapsedMs: Date.now() - startTs,
            }
          : null
      );
    }, 'image/png');
  };

  const handlePrintSheetDirectly = async () => {
    if (!canvasRef.current) return;
    const startTs = Date.now();
    setExportProgressTask({
      active: true,
      taskLabel: 'Prepare Studio Print Sheet',
      stageLabel: 'Stage 1/2 · Formatting high-contrast print raster...',
      progressPct: 50,
      currentItem: 1,
      totalItems: 1,
      format: 'PNG',
      dpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
      qualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
      elapsedMs: 0,
    });
    await pauseForProgressFrame(60);

    const capabilityCheck = validatePlanCapabilities(
      effectivePlan.id,
      selectedStudioId,
      'PRINT',
      {
        state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
        requestedFormat: 'PNG',
        requestedQualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
        requestedDpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
        requestedBatchCount: 1,
        dailyExportsUsed,
        allowWatermarkedSampleExport: true,
        plansMap: {
          ...INITIAL_PLANS,
          [effectivePlan.id]: effectivePlan,
        },
      }
    );
    if (!capabilityCheck.allowed) {
      setExportProgressTask(null);
      promptUpgradeForCapability(capabilityCheck.reason);
      return;
    }
    const nextDailyUsed = incrementLocalDailyExportCounter();
    recordFileTransferAndPromptSubscription(
      `varnank-${selectedStudioId.toLowerCase()}-print.png`,
      'Sent to Device Print Queue',
      capabilityCheck.clampedQualityPct,
      capabilityCheck.clampedDpi,
      nextDailyUsed
    );
    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            active: false,
            stageLabel: `Complete · Print sheet ready (${Date.now() - startTs} ms)`,
            progressPct: 100,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );
    window.print();
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current) return;
    const startTs = Date.now();
    setExportProgressTask({
      active: true,
      taskLabel: 'Prepare Device Share Package',
      stageLabel: 'Stage 1/2 · Encoding local share file...',
      progressPct: 55,
      currentItem: 1,
      totalItems: 1,
      format: 'PNG',
      dpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
      qualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
      elapsedMs: 0,
    });
    await pauseForProgressFrame(60);

    const capabilityCheck = validatePlanCapabilities(
      effectivePlan.id,
      selectedStudioId,
      'SHARE',
      {
        state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
        requestedFormat: 'PNG',
        requestedQualityPct: Math.min(exportQualityPct, planCapabilities.maxExportQualityPct),
        requestedDpi: Math.min(exportDpi, planCapabilities.maxExportDpi),
        requestedBatchCount: 1,
        dailyExportsUsed,
        allowWatermarkedSampleExport: true,
        plansMap: {
          ...INITIAL_PLANS,
          [effectivePlan.id]: effectivePlan,
        },
      }
    );

    if (!capabilityCheck.allowed) {
      setExportProgressTask(null);
      promptUpgradeForCapability(capabilityCheck.reason);
      return;
    }

    const nextDailyUsed = incrementLocalDailyExportCounter();
    recordFileTransferAndPromptSubscription(
      `varnank-${selectedStudioId.toLowerCase()}.png`,
      'Transferred via Device Share',
      capabilityCheck.clampedQualityPct,
      capabilityCheck.clampedDpi,
      nextDailyUsed
    );

    setExportProgressTask((prev) =>
      prev
        ? {
            ...prev,
            active: false,
            stageLabel: `Complete · Share package ready (${Date.now() - startTs} ms)`,
            progressPct: 100,
            elapsedMs: Date.now() - startTs,
          }
        : null
    );

    if (!navigator.share) {
      setStatusFeedback('Prepared file for device share; use Download if native share is unavailable.');
      return;
    }
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `varnank-${selectedStudioId.toLowerCase()}.png`, {
        type: 'image/png',
      });
      try {
        await navigator.share({
          title: 'Varnank Studios Local Export',
          files: [file],
        });
      } catch {
        // User cancelled share sheet
      }
    }, 'image/png');
  };

  // Permission is NEVER requested on startup/home/dashboard — ONLY when the user explicitly clicks the Camera task button
  const openCameraTaskModal = () => {
    setCameraModalOpen(true);
    setCameraStreamActive(false);
    setSessionTaskCount((c) => c + 1);
  };

  const requestCameraPermissionAndStartStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStreamActive(true);
      }
    } catch {
      setStatusFeedback('Camera access was not granted or no camera was found on this device.');
      setCameraStreamActive(false);
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoRef.current.videoWidth || 640;
    tempCanvas.height = videoRef.current.videoHeight || 480;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setLoadedSourceBytes(tempCanvas.width * tempCanvas.height * 4);
        setLoadedFileLabel('Camera Capture (Local Device RAM Only)');
        moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA');
      };
      img.src = tempCanvas.toDataURL('image/png');
    }
    stopCameraStream();
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraStreamActive(false);
    setCameraModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-12">
      {/* Text-Led Editorial Header (Section D: Strictly NO Hero Picture & NO Pane Directly Below It) */}
      <section className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
              100% On-Device Studio Workspace · Zero File Uploads
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181615] dark:text-[#F5F2EB]">
              Private Creative, PDF, ID &amp; Print Studios
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Prompt Wipe Working Buffer ONLY when near about 95% capacity */}
            {workingBufferUsagePct >= 95 && (
              <button
                type="button"
                data-testid="wipe-working-buffer-near-95"
                onClick={handleCloseAndWipeCurrentBuffer}
                className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-100 border border-amber-400 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#B44C32]" />
                <span>Wipe Working Buffer ({workingBufferUsagePct}% Near Full)</span>
              </button>
            )}
            <button
              type="button"
              data-testid="security-wipe-local-device-data-btn"
              onClick={onWipeAllLocalData}
              title="For Extra User & Subscriber Security: Wipe all local device data, photos, PDFs, and documents"
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-[#B91C1C] dark:text-[#F87171] bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe Local Device Data / Photos / PDF / Docs (For User &amp; Subscriber Security)</span>
            </button>
          </div>
        </div>

        {/* 4 Studio Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Select Studio"
          className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
        >
          {studios.map((studio) => {
            const active = studio.id === selectedStudioId;
            const studioToolCount = tools.filter(
              (t) => t.studioId === studio.id && t.enabled !== false
            ).length;
            return (
              <button
                key={studio.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => switchStudio(studio.id)}
                className={`p-3.5 rounded-xl text-left transition-colors border ${
                  active
                    ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615] dark:border-[#F5F2EB]'
                    : 'bg-white dark:bg-[#1C1A18] text-[#181615] dark:text-[#F5F2EB] border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
                }`}
              >
                <div className="flex items-center justify-between text-xs opacity-75 mb-1 font-mono">
                  <span>{studio.codeLabel}</span>
                  <span>{studioToolCount} Tools · Local</span>
                </div>
                <div className="font-semibold text-sm">{studio.name}</div>
                <p className="text-xs opacity-80 mt-1 line-clamp-2">{studio.summary}</p>
              </button>
            );
          })}
        </div>

        {/* Immediate Go-To / Move-To Task & Work Area Bar + Dynamic Progressive Activity Counters */}
        <div
          data-testid="workspace-quick-goto-bar"
          className="mt-4 p-3 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono font-semibold text-[#57534E] dark:text-[#A8A29E] mr-1 flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-[#B44C32]" />
              <span>Immediate Go-To Work Area:</span>
            </span>
            <button
              type="button"
              data-testid="goto-tools-btn"
              onClick={() => moveToWorkspaceSection('studio-tools-section', 'TOOLS')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                activeWorkspaceZone === 'TOOLS'
                  ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                  : 'bg-[#FAF8F5] dark:bg-[#262320] border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
              }`}
            >
              1. Tools &amp; Sizes ({studioTools.length})
            </button>
            <button
              type="button"
              data-testid="goto-work-area-btn"
              onClick={() => moveToWorkspaceSection('studio-work-area-section', 'WORK_AREA')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                activeWorkspaceZone === 'WORK_AREA'
                  ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                  : 'bg-[#FAF8F5] dark:bg-[#262320] border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
              }`}
            >
              2. Canvas Work Area ({currentSnap.widthPx}×{currentSnap.heightPx}px)
            </button>
            <button
              type="button"
              data-testid="goto-adjustments-btn"
              onClick={() => moveToWorkspaceSection('studio-adjustments-section', 'ADJUSTMENTS')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                activeWorkspaceZone === 'ADJUSTMENTS'
                  ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                  : 'bg-[#FAF8F5] dark:bg-[#262320] border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
              }`}
            >
              3. Adjustments ({historyIndex}/{Math.max(1, history.length - 1)} steps)
            </button>
            <button
              type="button"
              data-testid="goto-export-btn"
              onClick={() => moveToWorkspaceSection('studio-export-section', 'EXPORT')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                activeWorkspaceZone === 'EXPORT'
                  ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                  : 'bg-[#FAF8F5] dark:bg-[#262320] border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
              }`}
            >
              4. Output &amp; Export ({exportFormat} · ~{estimatedOutputKb} KB)
            </button>
          </div>

          {/* Live Dynamic & Progressive Activity Counters */}
          <div
            data-testid="dynamic-progressive-counters"
            className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]"
          >
            <span className="px-2 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#B44C32]" />
              <span>Tasks: {sessionTaskCount}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]">
              Buffer: {workingBufferUsagePct}%
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]">
              Quota:{' '}
              {planCapabilities.dailyExportLimit === -1
                ? `${sessionExportsCompleted} exported (Unlimited)`
                : `${dailyExportsUsed}/${planCapabilities.dailyFreeLimit} today`}
            </span>
          </div>
        </div>
      </section>

      {/* Post-Save / Post-Transfer Subscription & Extra Security Wipe Prompt */}
      {postSavePrompt && (
        <div
          data-testid="post-save-subscription-prompt"
          role="region"
          aria-label="Post-Save Plan Subscription and Security Prompt"
          className="mt-4 p-4 rounded-xl bg-white dark:bg-[#1C1A18] border-2 border-[#B44C32] space-y-3"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#15803D] dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {postSavePrompt.actionLabel}: {postSavePrompt.filename} ({postSavePrompt.qualityPct}% Quality · {postSavePrompt.dpi} DPI)
                </span>
              </div>
              {!isSubscriberActive ? (
                <p className="text-xs text-[#181615] dark:text-[#F5F2EB]">
                  <strong>Want unwatermarked 300–600 DPI print masters &amp; 25+ batch processing?</strong>{' '}
                  You have used <strong>{postSavePrompt.dailyUsedAfterSave}/{planCapabilities.dailyFreeLimit}</strong> strict daily Free exports today
                  {postSavePrompt.wasSampleWatermarked ? ' (exported with Free Sample Watermark)' : ''}. Buy or subscribe to a Paid Plan to unlock 100% lossless quality, 300–600 DPI resolution, 25–100+ file batch limits, and unlimited daily exports.
                </p>
              ) : (
                <p className="text-xs text-[#181615] dark:text-[#F5F2EB]">
                  Your file has been transferred to your device at full subscriber quality ({postSavePrompt.qualityPct}% · {postSavePrompt.dpi} DPI).
                </p>
              )}
              <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                <strong>For User &amp; Subscriber Security:</strong> Since your file is now saved on your device, we recommend wiping local device data, photos, PDFs, and documents from browser memory for extra privacy and security.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isSubscriberActive && (
                <button
                  type="button"
                  data-testid="post-save-subscribe-btn"
                  onClick={onRequestUpgrade}
                  className="min-h-[38px] px-3.5 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg whitespace-nowrap"
                >
                  Buy / Subscribe to Plan
                </button>
              )}
              <button
                type="button"
                data-testid="post-save-security-wipe-btn"
                onClick={() => {
                  handleCloseAndWipeCurrentBuffer();
                  onWipeAllLocalData();
                  setPostSavePrompt(null);
                }}
                className="min-h-[38px] px-3 py-2 text-xs font-medium text-[#B91C1C] dark:text-[#F87171] border border-[#B91C1C]/40 rounded-lg hover:bg-red-50/50 whitespace-nowrap"
              >
                Wipe Local Photos / PDF / Data (Security)
              </button>
              <button
                type="button"
                onClick={() => setPostSavePrompt(null)}
                className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-[#57534E] hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Prompt Banner when Free user hits strict 3/day cap or requests full Pro unlock */}
      {upgradePromptReason && (
        <div
          data-testid="plan-capability-upgrade-prompt"
          role="region"
          aria-label="Upgrade Required for High-Tier Capability"
          className="mt-4 p-4 rounded-xl bg-white dark:bg-[#1C1A18] border-2 border-[#B44C32] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>High-Tier Capability Locked on {planCapabilities.effectivePlanName}</span>
            </div>
            <p className="text-xs text-[#181615] dark:text-[#F5F2EB]">{upgradePromptReason}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRequestUpgrade}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg whitespace-nowrap"
            >
              Upgrade Plan Now
            </button>
            <button
              type="button"
              onClick={() => setUpgradePromptReason(null)}
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Adaptive RAM Warning or Status Feedback */}
      {ramWarning && (
        <div
          role="alert"
          className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs sm:text-sm text-amber-900 dark:text-amber-200"
        >
          {ramWarning}
        </div>
      )}
      {statusFeedback && (
        <div
          role="status"
          className="mt-4 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] text-xs text-[#181615] dark:text-[#F5F2EB] flex items-center justify-between"
        >
          <span>{statusFeedback}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Responsive Studio Work Area */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT ZONE: Studio Tools with Contextual Tool-Specific Sizes/Templates Nested Inside */}
        <aside
          id="studio-tools-section"
          className={`${
            workspaceLayout === 'WIDE_CANVAS' ? 'lg:col-span-3' : 'lg:col-span-3'
          } space-y-4 scroll-mt-20`}
        >
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E]">
                Studio Tools ({studios.find((s) => s.id === selectedStudioId)?.name || 'Workspace'})
              </h2>
              <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                {studioTools.length} tools
              </span>
            </div>

            {/* Free vs Paid Tool Filter */}
            <div className="grid grid-cols-3 gap-1 p-1 mb-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]">
              {(['ALL', 'FREE', 'PAID'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setToolTierFilter(filterKey)}
                  className={`min-h-[30px] px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                    toolTierFilter === filterKey
                      ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]'
                      : 'text-[#57534E] dark:text-[#A8A29E]'
                  }`}
                >
                  {filterKey === 'ALL'
                    ? 'All Tools'
                    : filterKey === 'FREE'
                    ? 'Free Tools'
                    : 'Paid Pro'}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {studioTools.map((tool) => {
                const isSelected = tool.id === selectedToolId;
                const isUnlocked =
                  tool.tier === 'FREE' ||
                  (tool.bundleId && unlockedBundles[tool.bundleId]) ||
                  (effectivePlan.unlocksPaidBundles &&
                    (tool.tier === 'PAID' ||
                      (tool.tier === 'PREMIUM' && effectivePlan.unlocksPremiumAutomation)));

                // Contextual presets ONLY for this specific tool when selected (never forced if empty)
                const contextualToolPresets = isSelected
                  ? getContextualPresetsForTool(tool.id)
                  : [];

                return (
                  <div
                    key={tool.id}
                    className={`rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-[#FAF8F5] dark:bg-[#262320] border-[#B44C32]'
                        : 'bg-transparent border-[#E7E2DA] dark:border-[#2E2B28] hover:bg-[#FAF8F5]/60 dark:hover:bg-[#262320]/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectTool(tool)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                          {tool.codeLabel}
                        </span>
                        {tool.tier === 'FREE' ? (
                          <span className="font-mono text-[11px] font-semibold text-[#15803D] dark:text-emerald-400">
                            Free · Included
                          </span>
                        ) : isUnlocked ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#15803D] dark:text-emerald-400">
                            <Sparkles className="w-3 h-3" />
                            <span>{tool.tier === 'PREMIUM' ? 'Premium Unlocked' : 'Paid Unlocked'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#B44C32] dark:text-[#E06D53]">
                            <Lock className="w-3 h-3" />
                            <span>
                              {tool.tier === 'PREMIUM' ? 'Premium Subscriber' : 'Paid Subscriber'}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                        {tool.name}
                      </div>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                        {tool.plainDescription}
                      </p>
                    </button>

                    {/* Contextual Sizes / Templates nested directly under this tool ONLY when applicable */}
                    {isSelected && contextualToolPresets.length > 0 && (
                      <div
                        data-testid="contextual-tool-presets"
                        className="px-3 pb-3 pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          <span className="font-semibold">
                            Optional Sizes &amp; Templates for this Tool
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCustomSizeDrawer((v) => !v)}
                            className="text-[#B44C32] dark:text-[#E06D53] hover:underline font-mono"
                          >
                            {showCustomSizeDrawer ? 'Hide Custom' : '+ Save Custom'}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {contextualToolPresets.map((preset) => {
                            const isActivePreset = currentSnap.codeLabel === preset.codeLabel;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className={`w-full p-2 rounded-lg text-left border text-xs transition-colors ${
                                  isActivePreset
                                    ? 'bg-white dark:bg-[#1C1A18] border-[#B44C32]'
                                    : 'bg-white/70 dark:bg-[#1C1A18]/70 border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]'
                                }`}
                              >
                                <div className="flex items-center justify-between font-mono text-[11px]">
                                  <span className="font-semibold text-[#181615] dark:text-[#F5F2EB]">
                                    {preset.codeLabel}
                                  </span>
                                  <span
                                    className={
                                      preset.tier === 'PAID'
                                        ? 'text-[#B44C32] dark:text-[#E06D53] font-semibold'
                                        : 'text-[#15803D] dark:text-emerald-400'
                                    }
                                  >
                                    {preset.tier === 'PAID'
                                      ? isSubscriberActive
                                        ? 'Paid · Unlocked'
                                        : 'Paid · Subscriber'
                                      : 'Free'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                                  {preset.name}
                                </div>
                                <div className="text-[10px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                                  {preset.dimensionsLabel}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Inline optional custom size saver inside the tool's contextual drawer */}
                        {showCustomSizeDrawer && (
                          <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex gap-1.5">
                            <input
                              type="text"
                              aria-label="Custom preset name"
                              placeholder="Enter custom preset name"
                              value={customPresetName}
                              onChange={(e) => setCustomPresetName(e.target.value)}
                              className="flex-1 min-h-[34px] px-2.5 py-1 text-xs rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!customPresetName.trim()) return;
                                const newP: PresetDefinition = {
                                  id: `LOCAL-${Date.now()}`,
                                  codeLabel: 'Custom Size',
                                  studioId: selectedStudioId,
                                  applicableToolIds: [tool.id],
                                  category: 'SIZE',
                                  name: customPresetName.trim(),
                                  dimensionsLabel: `${currentSnap.widthPx} × ${currentSnap.heightPx} px · ${exportDpi} DPI · Local`,
                                  widthPx: currentSnap.widthPx,
                                  heightPx: currentSnap.heightPx,
                                  dpi: exportDpi,
                                  bleedMm: currentSnap.bleedMm,
                                  tier: 'FREE',
                                  isGlobal: false,
                                };
                                onSaveLocalPreset(newP);
                                setCustomPresetName('');
                                setShowCustomSizeDrawer(false);
                                setStatusFeedback(
                                  `Saved custom size "${newP.name}" under ${tool.name}.`
                                );
                              }}
                              className="min-h-[34px] px-3 py-1 text-xs font-semibold rounded bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* CENTER ZONE: Multiple Input Options, Work Area View Modes & Interactive Canvas */}
        <section
          id="studio-work-area-section"
          className={`${
            workspaceLayout === 'WIDE_CANVAS' ? 'lg:col-span-9' : 'lg:col-span-6'
          } space-y-4 scroll-mt-20`}
        >
          {/* Multi-Source Input & Work Area Layout Bar */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Multiple Input Source Options */}
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLocalFileLoad(file);
                  }}
                  className="hidden"
                />
                <input
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleBatchFilesLoad(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </button>

                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  title={
                    isSubscriberActive
                      ? `Load up to ${effectivePlan.batchLimit} files into local batch queue`
                      : 'Free tier supports 1 file; Subscribers unlock up to 100-file batch queue'
                  }
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5 text-[#B44C32]" />
                  <span>
                    Batch Queue ({batchQueue.length}/
                    {isSubscriberActive ? effectivePlan.batchLimit : 1})
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="open-camera-task-btn"
                  onClick={openCameraTaskModal}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceImage(null);
                    setIsExploringSampleMode(false);
                    setLoadedFileLabel('Clean Specification Canvas');
                    setStatusFeedback('Switched to clean specification canvas.');
                  }}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] whitespace-nowrap"
                >
                  Blank Canvas
                </button>

                <button
                  type="button"
                  data-testid="load-sample-btn"
                  onClick={handleLoadInteractiveSample}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-[#FAF8F5] dark:bg-[#262320] text-[#B44C32] dark:text-[#E06D53] border border-[#B44C32]/50 rounded-lg hover:bg-[#B44C32] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isSubscriberActive ? 'Load Studio Sample' : 'Explore Watermarked Sample'}
                  </span>
                </button>
              </div>

              {/* 20-step Undo / Redo & Zoom */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Undo step"
                  disabled={historyIndex <= 0}
                  onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                  className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] disabled:opacity-40 flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="font-mono">{historyIndex}</span>
                </button>
                <button
                  type="button"
                  aria-label="Redo step"
                  disabled={historyIndex >= history.length - 1}
                  onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
                  className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] disabled:opacity-40 flex items-center gap-1"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <select
                  aria-label="Canvas Zoom"
                  value={zoomPct}
                  onChange={(e) => setZoomPct(Number(e.target.value))}
                  className="min-h-[38px] px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg"
                >
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                  <option value={125}>125%</option>
                  <option value={150}>150%</option>
                </select>
              </div>
            </div>

            {/* Work Area View Mode, Measurement Unit & Guide Controls */}
            <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mr-1">
                  Work Area Mode:
                </span>
                <button
                  type="button"
                  onClick={() => setWorkspaceLayout('STANDARD')}
                  className={`min-h-[30px] px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1 ${
                    workspaceLayout === 'STANDARD'
                      ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>3-Zone Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceLayout('SPLIT_COMPARE')}
                  className={`min-h-[30px] px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1 ${
                    workspaceLayout === 'SPLIT_COMPARE'
                      ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  <span>Before / After Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceLayout('WIDE_CANVAS')}
                  className={`min-h-[30px] px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1 ${
                    workspaceLayout === 'WIDE_CANVAS'
                      ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expanded Canvas</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Units:</span>
                {(['px', 'mm', 'in'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setDisplayUnit(u)}
                    className={`min-h-[28px] px-2 py-0.5 text-[11px] font-mono rounded border ${
                      displayUnit === u
                        ? 'bg-[#B44C32] text-white border-[#B44C32]'
                        : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                    }`}
                  >
                    {u}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowRulerGuides((v) => !v)}
                  className={`min-h-[28px] px-2.5 py-0.5 text-[11px] font-medium rounded border ${
                    showRulerGuides
                      ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  {showRulerGuides ? 'Rulers On' : 'Rulers Off'}
                </button>
              </div>
            </div>

            {/* Active Batch File Queue Strip (When user loads files) */}
            {batchQueue.length > 0 && (
              <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-mono text-[#57534E] shrink-0">
                  Local Queue ({batchQueue.length}/{effectivePlan.batchLimit}):
                </span>
                {batchQueue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSourceImage(item.image);
                      setActiveQueueId(item.id);
                      setLoadedFileLabel(`${item.name} (${item.sizeKb} KB · Local RAM)`);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono border shrink-0 ${
                      activeQueueId === item.id
                        ? 'bg-[#181615] text-white border-[#181615]'
                        : 'bg-[#FAF8F5] dark:bg-[#262320] border-[#E7E2DA]'
                    }`}
                  >
                    {item.name} ({item.sizeKb} KB)
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Watermarked Sample Exploration Banner for Paid Tools on Free/Freemium Tier */}
          {(isCurrentToolLocked || isUsingWatermarkedSampleFeatures) && (
            <div
              data-testid="watermarked-sample-banner"
              className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53]">
                  Watermarked Sample &amp; Capped Paid Feature Exploration · {activeTool?.codeLabel}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                  {activeTool?.name} — Exploring in Capped Sample Mode ({planCapabilities.quality}% Quality · {planCapabilities.dpi} DPI · 1 File)
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                  {bundleStatusMessage ||
                    `Free & Freemium users can check, analyze, and export up to ${planCapabilities.dailyFreeLimit} watermarked/capped sample files per day (${dailyExportsUsed}/${planCapabilities.dailyFreeLimit} used today). Subscribe to unlock unwatermarked 300–600 DPI & 25+ batch output.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onRequestUpgrade}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg whitespace-nowrap shrink-0"
              >
                Subscribe / Upgrade to Pro
              </button>
            </div>
          )}

          {/* Drag-and-Drop Interactive Canvas Surface (Supports Single View & Split Before/After View) */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 1) {
                handleBatchFilesLoad(e.dataTransfer.files);
              } else {
                const file = e.dataTransfer.files?.[0];
                if (file) handleLocalFileLoad(file);
              }
            }}
            className="relative p-6 rounded-xl bg-[#F1EFEA] dark:bg-[#181615] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col items-center justify-center min-h-[420px] overflow-auto"
          >
            {showRulerGuides && (
              <div className="w-full flex items-center justify-between px-2 pb-2 mb-2 border-b border-dashed border-[#B44C32]/50 text-[10px] font-mono text-[#B44C32]">
                <span>0 {displayUnit}</span>
                <span>
                  Safe Margin Guide · {formatDimensionInUnit(currentSnap.widthPx)} ×{' '}
                  {formatDimensionInUnit(currentSnap.heightPx)} @ {exportDpi} DPI
                </span>
                <span>{formatDimensionInUnit(currentSnap.widthPx)}</span>
              </div>
            )}

            {workspaceLayout === 'SPLIT_COMPARE' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full items-center justify-items-center">
                <div className="space-y-1.5 text-center">
                  <div className="text-[11px] font-mono text-[#57534E]">
                    BEFORE (Original Input / Default)
                  </div>
                  <canvas
                    ref={compareOriginalCanvasRef}
                    className="max-w-full h-auto rounded bg-white border border-[#D6D0C4]"
                  />
                </div>
                <div className="space-y-1.5 text-center">
                  <div className="text-[11px] font-mono font-semibold text-[#B44C32]">
                    AFTER ({activeTool?.name} · {exportQualityPct}% · {exportDpi} DPI)
                  </div>
                  <canvas
                    ref={canvasRef}
                    data-testid="studio-canvas"
                    className="max-w-full h-auto rounded bg-white border-2 border-[#B44C32]"
                  />
                </div>
              </div>
            ) : (
              <div
                className="transition-transform origin-center shadow-sm"
                style={{ transform: `scale(${zoomPct / 100})` }}
              >
                <canvas
                  ref={canvasRef}
                  data-testid="studio-canvas"
                  className="max-w-full h-auto rounded bg-white border border-[#D6D0C4]"
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
              <span>
                {formatDimensionInUnit(currentSnap.widthPx)} ×{' '}
                {formatDimensionInUnit(currentSnap.heightPx)} ({currentSnap.widthPx}×
                {currentSnap.heightPx}px · {canvasMegapixels} MP)
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentSnap.codeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Est. {exportFormat}: ~{estimatedOutputKb} KB</span>
              <span aria-hidden="true">·</span>
              <span>{loadedFileLabel || 'Drag & drop files, paste (Ctrl+V), or open a file'}</span>
            </div>

            {/* Live Canvas Export Task Progress Overlay / Banner */}
            {exportProgressTask && (
              <div
                data-testid="canvas-export-progress-banner"
                role="status"
                aria-live="polite"
                className="mt-3 w-full max-w-xl p-3 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] shadow-sm space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-[#181615] dark:text-[#F5F2EB]">
                    {exportProgressTask.active ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B44C32] animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    )}
                    <span>{exportProgressTask.taskLabel}</span>
                  </span>
                  <span className="font-mono text-[#B44C32]">
                    {exportProgressTask.progressPct}% ({exportProgressTask.currentItem}/
                    {exportProgressTask.totalItems})
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E7E2DA] dark:bg-[#2E2B28] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      exportProgressTask.active ? 'bg-[#B44C32]' : 'bg-[#15803D]'
                    }`}
                    style={{ width: `${exportProgressTask.progressPct}%` }}
                  />
                </div>
                <div className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                  {exportProgressTask.stageLabel}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT ZONE: Adjustments, Free vs Paid Output Comparison & Multi-Option Export */}
        <aside
          className={`${
            workspaceLayout === 'WIDE_CANVAS'
              ? 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6'
              : 'lg:col-span-3 space-y-5'
          }`}
        >
          {/* Work Area Adjustments Card */}
          <div
            id="studio-adjustments-section"
            className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4 scroll-mt-20"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Work Area &amp; Tool Adjustments</span>
              </h2>
              <button
                type="button"
                title="Rotate 90° Clockwise"
                onClick={() => {
                  pushSnapshot((p) => ({
                    ...p,
                    rotationDeg: (p.rotationDeg + 90) % 360,
                  }));
                }}
                className="min-h-[32px] px-2.5 py-1 text-xs font-mono rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32] flex items-center gap-1"
              >
                <RotateCw className="w-3 h-3" />
                <span>{currentSnap.rotationDeg}°</span>
              </button>
            </div>

            {/* Quick Aspect Ratio Locks */}
            <div>
              <div className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                Quick Aspect Locks (Max {effectivePlan.maxResolutionPx}px on {effectivePlan.name})
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '1:1', w: 1000, h: 1000 },
                  { label: '4:3', w: 1200, h: 900 },
                  { label: '35×45', w: 413, h: 531 },
                  { label: 'A4', w: 1240, h: 1754 },
                ].map((ratio) => (
                  <button
                    key={ratio.label}
                    type="button"
                    onClick={() => {
                      pushSnapshot((p) => ({
                        ...p,
                        widthPx: Math.min(effectivePlan.maxResolutionPx, ratio.w),
                        heightPx: Math.min(effectivePlan.maxResolutionPx, ratio.h),
                      }));
                    }}
                    className="min-h-[32px] px-2 py-1 text-xs font-mono rounded border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]"
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="input-width-px"
                  className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                >
                  Width (px)
                </label>
                <input
                  id="input-width-px"
                  type="number"
                  min={100}
                  max={effectivePlan.maxResolutionPx}
                  value={currentSnap.widthPx}
                  onChange={(e) =>
                    pushSnapshot((p) => ({
                      ...p,
                      widthPx: Math.min(
                        effectivePlan.maxResolutionPx,
                        Math.max(100, Number(e.target.value) || 400)
                      ),
                    }))
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
                />
              </div>
              <div>
                <label
                  htmlFor="input-height-px"
                  className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                >
                  Height (px)
                </label>
                <input
                  id="input-height-px"
                  type="number"
                  min={100}
                  max={effectivePlan.maxResolutionPx}
                  value={currentSnap.heightPx}
                  onChange={(e) =>
                    pushSnapshot((p) => ({
                      ...p,
                      heightPx: Math.min(
                        effectivePlan.maxResolutionPx,
                        Math.max(100, Number(e.target.value) || 400)
                      ),
                    }))
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
                />
              </div>
            </div>

            {/* Tool-Specific Contextual Control for Strict KB Target Size Compressor (T21) */}
            {selectedToolId === 'T21' && (
              <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <label htmlFor="range-kb-target">Portal Target File Size Limit</label>
                  <span className="font-mono text-[#B44C32]">{targetKbLimit} KB</span>
                </div>
                <input
                  id="range-kb-target"
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={targetKbLimit}
                  onChange={(e) => setTargetKbLimit(Number(e.target.value))}
                  className="w-full accent-[#B44C32]"
                />
                <p className="text-[11px] text-[#57534E]">
                  Compresses JPEG/WebP output to fit strict government portal upload rules (20KB–50KB).
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="input-heading-text"
                className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
              >
                Document / Frame Title
              </label>
              <input
                id="input-heading-text"
                type="text"
                value={currentSnap.titleText}
                onChange={(e) => pushSnapshot((p) => ({ ...p, titleText: e.target.value }))}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              />
            </div>

            <div>
              <label
                htmlFor="input-subtitle-text"
                className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
              >
                Subtitle / Edition Note
              </label>
              <input
                id="input-subtitle-text"
                type="text"
                value={currentSnap.subtitleText}
                onChange={(e) => pushSnapshot((p) => ({ ...p, subtitleText: e.target.value }))}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              />
            </div>

            <div>
              <label
                htmlFor="select-bg-style"
                className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
              >
                Backing Surface
              </label>
              <select
                id="select-bg-style"
                value={currentSnap.backgroundStyle}
                onChange={(e) =>
                  pushSnapshot((p) => ({
                    ...p,
                    backgroundStyle: e.target.value as CanvasRenderParams['backgroundStyle'],
                  }))
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                <option value="WARM_PAPER">Warm Archival Paper</option>
                <option value="PURE_WHITE">Pure White Backing</option>
                <option value="LIGHT_BLUE_ID">Official Light Blue ID Backing</option>
                <option value="SLATE_GRID">Drafting Alignment Grid</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-1">
              <div>
                <div className="flex justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <label htmlFor="range-brightness">Brightness</label>
                  <span className="font-mono">{currentSnap.brightness}%</span>
                </div>
                <input
                  id="range-brightness"
                  type="range"
                  min={60}
                  max={140}
                  value={currentSnap.brightness}
                  onChange={(e) =>
                    pushSnapshot((p) => ({ ...p, brightness: Number(e.target.value) }))
                  }
                  className="w-full accent-[#B44C32]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <label htmlFor="range-contrast">Contrast</label>
                  <span className="font-mono">{currentSnap.contrast}%</span>
                </div>
                <input
                  id="range-contrast"
                  type="range"
                  min={60}
                  max={140}
                  value={currentSnap.contrast}
                  onChange={(e) =>
                    pushSnapshot((p) => ({ ...p, contrast: Number(e.target.value) }))
                  }
                  className="w-full accent-[#B44C32]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <label htmlFor="range-saturation">Color Saturation</label>
                  <span className="font-mono">{currentSnap.saturation}%</span>
                </div>
                <input
                  id="range-saturation"
                  type="range"
                  min={0}
                  max={180}
                  value={currentSnap.saturation}
                  onChange={(e) =>
                    pushSnapshot((p) => ({ ...p, saturation: Number(e.target.value) }))
                  }
                  className="w-full accent-[#B44C32]"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <label htmlFor="range-warmth">Warmth / Cool Tint</label>
                  <span className="font-mono">{currentSnap.warmth}</span>
                </div>
                <input
                  id="range-warmth"
                  type="range"
                  min={-40}
                  max={40}
                  value={currentSnap.warmth}
                  onChange={(e) =>
                    pushSnapshot((p) => ({ ...p, warmth: Number(e.target.value) }))
                  }
                  className="w-full accent-[#B44C32]"
                />
              </div>
            </div>

            {/* Studio-Specific Controls (Free + Gated Paid Controls) */}
            <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#181615] dark:text-[#F5F2EB]">
                  ID Alignment Guide
                </span>
                <button
                  type="button"
                  onClick={() => pushSnapshot((p) => ({ ...p, showIdGuide: !p.showIdGuide }))}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border ${
                    currentSnap.showIdGuide
                      ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  {currentSnap.showIdGuide ? 'Shown' : 'Hidden'}
                </button>
              </div>

              {/* Professional Studio Features (Free/Freemium can explore Watermarked Samples; full unwatermarked output requires Paid Plan) */}
              <div
                data-testid="pro-feature-controls"
                className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#B44C32]/40 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53] flex items-center gap-1">
                    {planCapabilities.professionalFeatures.paidToolsAccess ? (
                      <Sparkles className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {planCapabilities.professionalFeatures.paidToolsAccess
                        ? `Professional Features Unlocked (${planCapabilities.effectivePlanName})`
                        : 'Pro Controls (Sample Preview Active on Free)'}
                    </span>
                  </div>
                  {!planCapabilities.professionalFeatures.paidToolsAccess && (
                    <button
                      type="button"
                      onClick={() => {
                        promptUpgradeForCapability(
                          planCapabilities.upgradePromptMessage
                        );
                        onRequestUpgrade();
                      }}
                      className="text-[11px] font-semibold text-[#B44C32] dark:text-[#E06D53] hover:underline"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                {selectedStudioId === 'S3' && (
                  <div>
                    <label
                      htmlFor="select-id-copies"
                      className="block text-xs text-[#57534E] mb-1"
                    >
                      Multi-Copy Print Sheet Quantity (
                      {planCapabilities.professionalFeatures.multiCopyIdSheetAccess
                        ? `Max ${planCapabilities.maxIdSheetCopiesAllowed}-up`
                        : '4-up Watermarked Sample Preview / 1-up Free'}
                      )
                    </label>
                    <select
                      id="select-id-copies"
                      value={currentSnap.idSheetCopies}
                      onChange={(e) => {
                        const copies = Number(e.target.value) as 1 | 4 | 8 | 16;
                        if (
                          !planCapabilities.professionalFeatures.multiCopyIdSheetAccess &&
                          copies > 4
                        ) {
                          promptUpgradeForCapability(
                            `${copies}-up ID print sheet requires an active Paid Plan (Free tier allows 1-up or 4-up watermarked sample preview).`
                          );
                          return;
                        }
                        if (
                          planCapabilities.professionalFeatures.multiCopyIdSheetAccess &&
                          copies > planCapabilities.maxIdSheetCopiesAllowed
                        ) {
                          promptUpgradeForCapability(
                            `${copies}-up ID print sheet requires a higher Paid Plan.`
                          );
                          return;
                        }
                        if (!planCapabilities.professionalFeatures.multiCopyIdSheetAccess && copies === 4) {
                          setIsExploringSampleMode(true);
                          setStatusFeedback(
                            'Exploring 4-Copy ID Sheet in Watermarked Sample Mode (72 DPI / 80% cap). Save sample to test or subscribe for unwatermarked 300 DPI sheets.'
                          );
                        }
                        pushSnapshot((p) => ({
                          ...p,
                          idSheetCopies: copies,
                          showIdGuide: copies === 1,
                          widthPx: copies === 16 ? 1200 : copies > 1 ? 800 : 413,
                          heightPx: copies === 16 ? 1680 : copies > 1 ? 1120 : 531,
                        }));
                      }}
                      className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA]"
                    >
                      <option value={1}>Single ID Photo (1-up · Free)</option>
                      <option value={4}>
                        {planCapabilities.professionalFeatures.multiCopyIdSheetAccess
                          ? '4-Copy Print Sheet (with Cut Lines · Unlocked)'
                          : '4-Copy Print Sheet (Watermarked Sample Preview · Free Explore)'}
                      </option>
                      <option
                        value={8}
                        disabled={planCapabilities.maxIdSheetCopiesAllowed < 8}
                      >
                        8-Copy A4/4×6 Sheet (with Cut Lines · Paid Subscriber)
                      </option>
                      <option
                        value={16}
                        disabled={planCapabilities.maxIdSheetCopiesAllowed < 16}
                      >
                        16-Copy Master Studio Sheet (with Cut Lines · Monthly/Annual Pro)
                      </option>
                    </select>
                  </div>
                )}

                {(selectedStudioId === 'S2' || selectedStudioId === 'S3') && (
                  <button
                    type="button"
                    onClick={() => {
                      const willEnable = currentSnap.redactionBoxes.length === 0;
                      if (willEnable && !planCapabilities.professionalFeatures.permanentRedactionAccess) {
                        setIsExploringSampleMode(true);
                        setStatusFeedback(
                          'Exploring Redaction Mask in Watermarked Sample Mode (72 DPI / 80% cap). Subscribe to unlock unwatermarked 300 DPI redaction.'
                        );
                      }
                      pushSnapshot((p) => ({
                        ...p,
                        redactionBoxes:
                          p.redactionBoxes.length > 0
                            ? []
                            : [
                                { xPct: 14, yPct: 54, wPct: 52, hPct: 8 },
                                { xPct: 14, yPct: 68, wPct: 38, hPct: 6 },
                              ],
                      }));
                    }}
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium rounded bg-[#181615] text-white hover:bg-[#2E2B28] transition-colors"
                  >
                    {currentSnap.redactionBoxes.length > 0
                      ? 'Clear Redaction Blocks'
                      : planCapabilities.professionalFeatures.permanentRedactionAccess
                      ? 'Apply Permanent Redaction Mask (Pro)'
                      : 'Preview Redaction Mask (Watermarked Sample)'}
                  </button>
                )}

                {selectedStudioId === 'S4' && (
                  <button
                    type="button"
                    onClick={() => {
                      const willEnable = !currentSnap.showPrintCropMarks;
                      if (
                        willEnable &&
                        !planCapabilities.professionalFeatures.pressBleedAndCropMarksAccess
                      ) {
                        setIsExploringSampleMode(true);
                        setStatusFeedback(
                          'Exploring 3mm Bleed & Corner Crop Marks in Watermarked Sample Mode (72 DPI / 80% cap). Subscribe for 300–600 DPI press output.'
                        );
                      }
                      pushSnapshot((p) => ({
                        ...p,
                        showPrintCropMarks: !p.showPrintCropMarks,
                      }));
                    }}
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium rounded bg-[#181615] text-white hover:bg-[#2E2B28] transition-colors"
                  >
                    {currentSnap.showPrintCropMarks
                      ? 'Hide Press Crop & Bleed Marks'
                      : planCapabilities.professionalFeatures.pressBleedAndCropMarksAccess
                      ? 'Add 3mm Bleed & Corner Crop Marks (Pro)'
                      : 'Preview 3mm Bleed & Crop Marks (Watermarked Sample)'}
                  </button>
                )}

                <div>
                  <label htmlFor="input-stamp" className="block text-xs text-[#57534E] mb-1">
                    Batch Stamp / Watermark Label{' '}
                    {!planCapabilities.professionalFeatures.customWatermarkStampAccess &&
                      '(Sample Preview on Free · Full on Paid)'}
                  </label>
                  <input
                    id="input-stamp"
                    type="text"
                    placeholder={
                      planCapabilities.professionalFeatures.customWatermarkStampAccess
                        ? 'Enter watermark or stamp text'
                        : 'Enter sample stamp text'
                    }
                    value={currentSnap.stampText}
                    onChange={(e) => {
                      if (!planCapabilities.professionalFeatures.customWatermarkStampAccess && e.target.value.trim()) {
                        setIsExploringSampleMode(true);
                      }
                      pushSnapshot((p) => ({ ...p, stampText: e.target.value }));
                    }}
                    className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA]"
                  />
                </div>

                {!planCapabilities.professionalFeatures.paidToolsAccess && (
                  <button
                    type="button"
                    data-testid="pro-controls-upgrade-btn"
                    onClick={() => {
                      promptUpgradeForCapability(planCapabilities.upgradePromptMessage);
                      onRequestUpgrade();
                    }}
                    className="w-full min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#B44C32] text-[#FAF8F5] hover:bg-[#9E3F27] transition-colors"
                  >
                    Upgrade to Unlock Unwatermarked Pro Controls (300 DPI · 25+ Batch)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Plan-Capped Export, Free vs Paid Output Differentiation & Multi-Delivery Card */}
          <div
            id="studio-export-section"
            className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3.5 scroll-mt-20"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E]">
                Output Options, Quality &amp; Quantity
              </h2>
              <span
                className={`text-[11px] font-mono font-semibold ${
                  isSubscriberActive
                    ? 'text-[#15803D] dark:text-emerald-400'
                    : 'text-[#B44C32] dark:text-[#E06D53]'
                }`}
              >
                {planCapabilities.effectivePlanName}
              </span>
            </div>

            {/* Free vs Paid Subscriber Output Comparison Matrix */}
            <div
              data-testid="free-vs-paid-output-comparison"
              className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] text-[11px] space-y-1.5"
            >
              <div className="font-semibold text-[#181615] dark:text-[#F5F2EB]">
                Free vs Subscriber Output Capabilities
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E7E2DA] dark:border-[#2E2B28]">
                <div>
                  <div className="font-mono font-semibold text-[#57534E]">Free / Guest Tier</div>
                  <ul className="text-[10px] text-[#57534E] space-y-0.5 mt-0.5">
                    <li>• 80%–85% Max Quality</li>
                    <li>• 72–150 DPI Screen/Office</li>
                    <li>• Single File (1x) Limit</li>
                    <li>• PNG, JPEG (+WebP/PDF)</li>
                  </ul>
                </div>
                <div>
                  <div className="font-mono font-semibold text-[#B44C32] dark:text-[#E06D53]">
                    Paid / Subscriber Pro
                  </div>
                  <ul className="text-[10px] text-[#181615] dark:text-[#F5F2EB] space-y-0.5 mt-0.5">
                    <li>• 95%–100% Lossless</li>
                    <li>• 300–600 DPI Print/Press</li>
                    <li>• 25x–100x+ Batch &amp; 16-Up</li>
                    <li>• + Vector SVG &amp; Batch ZIP</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="select-export-format"
                className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
              >
                Output Format
              </label>
              <select
                id="select-export-format"
                value={exportFormat}
                onChange={(e) => {
                  const nextFmt = e.target.value as ExportFormatCode;
                  const fmtCheck = validatePlanCapabilities({
                    planId: effectivePlan.id,
                    state: entitlementState === 'NONE' && sessionToken ? 'ACTIVE' : entitlementState,
                    requestedFormat: nextFmt,
                    plansMap: {
                      ...INITIAL_PLANS,
                      [effectivePlan.id]: effectivePlan,
                    },
                  });
                  if (!fmtCheck.allowed) {
                    promptUpgradeForCapability(fmtCheck.reason);
                    return;
                  }
                  setExportFormat(nextFmt);
                }}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                <option value="PNG">PNG (Lossless Visual · Free)</option>
                <option value="JPEG">JPEG (Compact Photo · Free)</option>
                <option value="WEBP" disabled={!planCapabilities.allowedFormats.includes('WEBP')}>
                  WebP (High Efficiency ·{' '}
                  {planCapabilities.allowedFormats.includes('WEBP') ? 'Unlocked' : 'Freemium+'})
                </option>
                <option value="PDF" disabled={!planCapabilities.allowedFormats.includes('PDF')}>
                  PDF (Print Sheet / Doc ·{' '}
                  {planCapabilities.allowedFormats.includes('PDF') ? 'Unlocked' : 'Freemium+'})
                </option>
                <option value="SVG" disabled={!planCapabilities.allowedFormats.includes('SVG')}>
                  SVG (Scalable Vector ·{' '}
                  {planCapabilities.allowedFormats.includes('SVG')
                    ? 'Subscriber Unlocked'
                    : 'Paid Subscriber'})
                </option>
                <option value="ZIP" disabled={!planCapabilities.allowedFormats.includes('ZIP')}>
                  ZIP Archive (25+ Batch Output ·{' '}
                  {planCapabilities.allowedFormats.includes('ZIP')
                    ? 'Subscriber Unlocked'
                    : 'Paid Subscriber'})
                </option>
              </select>
            </div>

            {/* Output Quality Presets + Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">
                <label htmlFor="range-export-quality">
                  Output Quality (Max {planCapabilities.maxExportQualityPct}%)
                </label>
                <span className="font-mono font-semibold text-[#181615] dark:text-[#F5F2EB]">
                  {exportQualityPct}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[
                  { label: '70% Draft', val: 70, tag: 'Free' },
                  { label: '80% Free', val: 80, tag: 'Free' },
                  { label: '95% HD', val: 95, tag: 'Paid' },
                  { label: '100% Pro', val: 100, tag: 'Pro' },
                ].map((qPreset) => {
                  const locked = qPreset.val > planCapabilities.maxExportQualityPct;
                  return (
                    <button
                      key={qPreset.val}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          promptUpgradeForCapability(
                            `${qPreset.val}% lossless quality requires a Paid Plan (current limit on ${planCapabilities.effectivePlanName}: ${planCapabilities.maxExportQualityPct}%). Upgrade to unlock.`
                          );
                          return;
                        }
                        setExportQualityPct(qPreset.val);
                      }}
                      className={`min-h-[28px] px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                        exportQualityPct === qPreset.val
                          ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110]'
                          : locked
                          ? 'opacity-50 border-dashed border-[#E7E2DA]'
                          : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                      }`}
                    >
                      {qPreset.label}
                    </button>
                  );
                })}
              </div>
              <input
                id="range-export-quality"
                type="range"
                min={60}
                max={planCapabilities.maxExportQualityPct}
                value={exportQualityPct}
                onChange={(e) => setExportQualityPct(Number(e.target.value))}
                className="w-full accent-[#B44C32]"
              />
              {!planCapabilities.professionalFeatures.losslessQualityAccess && (
                <div className="flex items-center justify-between text-[11px] text-[#57534E] mt-0.5">
                  <span>Free cap: {planCapabilities.maxExportQualityPct}%</span>
                  <button
                    type="button"
                    onClick={onRequestUpgrade}
                    className="text-[#B44C32] font-medium hover:underline"
                  >
                    Unlock 100% Lossless
                  </button>
                </div>
              )}
            </div>

            {/* Target Output Resolution DPI Selector & Quick DPI Buttons (72/150 Free vs 300/600 Paid) */}
            <div>
              <label
                htmlFor="select-export-dpi"
                className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
              >
                Output Print Density (Max {planCapabilities.maxExportDpi} DPI)
              </label>
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[
                  { label: '72 DPI', val: 72 },
                  { label: '150 DPI', val: 150 },
                  { label: '300 DPI', val: 300 },
                  { label: '600 DPI', val: 600 },
                ].map((dpiOpt) => {
                  const locked = dpiOpt.val > planCapabilities.maxExportDpi;
                  return (
                    <button
                      key={dpiOpt.val}
                      type="button"
                      data-testid={`dpi-btn-${dpiOpt.val}`}
                      onClick={() => {
                        if (locked) {
                          promptUpgradeForCapability(
                            `${dpiOpt.val} DPI print quality exceeds the ${planCapabilities.maxExportDpi} DPI limit on ${planCapabilities.effectivePlanName}. Upgrade to unlock 300–600 DPI print output.`
                          );
                          return;
                        }
                        setExportDpi(dpiOpt.val);
                      }}
                      className={`min-h-[28px] px-1.5 py-0.5 text-[10px] font-mono rounded border ${
                        exportDpi === dpiOpt.val
                          ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110]'
                          : locked
                          ? 'opacity-50 border-dashed border-[#E7E2DA]'
                          : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                      }`}
                    >
                      {dpiOpt.label}
                    </button>
                  );
                })}
              </div>
              <select
                id="select-export-dpi"
                value={exportDpi}
                onChange={(e) => {
                  const requested = Number(e.target.value);
                  if (requested > planCapabilities.maxExportDpi) {
                    promptUpgradeForCapability(
                      `${requested} DPI requires a Paid Plan (current max: ${planCapabilities.maxExportDpi} DPI).`
                    );
                    return;
                  }
                  setExportDpi(requested);
                }}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                <option value={72}>72 DPI (Screen / Web Draft · Free)</option>
                <option value={150}>150 DPI (Standard Office Print · Free Max)</option>
                <option
                  value={300}
                  disabled={!planCapabilities.professionalFeatures.highDpiPrintAccess}
                >
                  300 DPI (High-Def Studio / ID Print ·{' '}
                  {planCapabilities.professionalFeatures.highDpiPrintAccess
                    ? 'Unlocked'
                    : 'Paid Subscriber'}
                  )
                </option>
                <option
                  value={600}
                  disabled={!planCapabilities.professionalFeatures.archival600DpiAccess}
                >
                  600 DPI (Archival Press Master ·{' '}
                  {planCapabilities.professionalFeatures.archival600DpiAccess
                    ? 'Unlocked'
                    : 'Premium Annual'}
                  )
                </option>
              </select>
            </div>

            {/* Batch Quantity Cap (1 on Free/Guest vs 25–100 on Paid Plans) */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">
                <label htmlFor="input-batch-count">
                  Batch File Limit (Max {planCapabilities.batchFileLimit}{' '}
                  {planCapabilities.batchFileLimit === 1 ? 'file' : 'files'})
                </label>
                {!planCapabilities.professionalFeatures.batchProcessingAccess && (
                  <button
                    type="button"
                    onClick={() => {
                      promptUpgradeForCapability(
                        `Batch processing (25–100+ files) requires an active Paid Plan (${planCapabilities.effectivePlanName} is limited to 1 file at a time).`
                      );
                      onRequestUpgrade();
                    }}
                    className="text-[11px] font-semibold text-[#B44C32] hover:underline"
                  >
                    Unlock 25+ Batch
                  </button>
                )}
              </div>
              <input
                id="input-batch-count"
                type="number"
                min={1}
                max={planCapabilities.batchFileLimit}
                disabled={!planCapabilities.professionalFeatures.batchProcessingAccess}
                value={planCapabilities.professionalFeatures.batchProcessingAccess ? batchCount : 1}
                onChange={(e) =>
                  setBatchCount(
                    Math.min(
                      planCapabilities.batchFileLimit,
                      Math.max(1, Number(e.target.value))
                    )
                  )
                }
                className="w-full min-h-[38px] px-3 py-1 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Dynamic Progressive Daily Quota & Working Buffer Status Meters */}
            <div
              data-testid="daily-quota-status"
              className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span>
                  Daily Quota:{' '}
                  {planCapabilities.dailyExportLimit === -1
                    ? `Unlimited (${sessionExportsCompleted} exported)`
                    : `${dailyExportsUsed}/${planCapabilities.dailyFreeLimit} used today (Strict 3/day Free limit)`}
                </span>
                <span>
                  Batch Cap: {planCapabilities.batchLimit}{' '}
                  {planCapabilities.batchLimit === 1 ? 'file' : 'files'}
                </span>
              </div>
              {planCapabilities.dailyExportLimit !== -1 && (
                <div className="w-full h-1.5 rounded-full bg-[#E7E2DA] dark:bg-[#2E2B28] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      dailyExportsUsed >= planCapabilities.dailyFreeLimit
                        ? 'bg-[#B91C1C]'
                        : 'bg-[#B44C32]'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((dailyExportsUsed / Math.max(1, planCapabilities.dailyFreeLimit)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-[10px]">
                <span>
                  Working Buffer Load: {workingBufferUsagePct}% (Undo {historyIndex}/
                  {Math.max(1, history.length - 1)} · Queue {batchQueue.length}/
                  {planCapabilities.batchLimit})
                </span>
                <span>Est. Size: ~{estimatedOutputKb} KB</span>
              </div>
            </div>

            {/* Visual Export Task Progress Indicator for Heavy Browser-Side Processing */}
            {exportProgressTask && (
              <div
                data-testid="export-progress-indicator"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={exportProgressTask.progressPct}
                aria-label={exportProgressTask.taskLabel}
                className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#B44C32] space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-[#181615] dark:text-[#F5F2EB]">
                    {exportProgressTask.active ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B44C32] animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    )}
                    <span>{exportProgressTask.taskLabel}</span>
                  </span>
                  <span className="font-mono text-[#B44C32]">
                    {exportProgressTask.progressPct}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E7E2DA] dark:bg-[#2E2B28] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      exportProgressTask.active ? 'bg-[#B44C32]' : 'bg-[#15803D]'
                    }`}
                    style={{ width: `${exportProgressTask.progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                  <span className="truncate">{exportProgressTask.stageLabel}</span>
                  <span className="shrink-0 ml-2">
                    Item {exportProgressTask.currentItem}/{exportProgressTask.totalItems}
                  </span>
                </div>
              </div>
            )}

            {/* Multiple Output & Delivery Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                data-testid="download-export-btn"
                disabled={Boolean(exportProgressTask?.active)}
                onClick={handleExportOutput}
                className="w-full min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] disabled:opacity-60 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {exportProgressTask?.active ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {exportProgressTask?.active
                    ? `Processing ${exportFormat} (${exportProgressTask.progressPct}%)...`
                    : `Download ${exportFormat} (${exportQualityPct}% · ${exportDpi} DPI)`}
                </span>
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="copy-png-export-btn"
                  disabled={Boolean(exportProgressTask?.active)}
                  onClick={handleCopyCanvasToClipboard}
                  className="min-h-[38px] px-2.5 py-1.5 text-[11px] font-medium text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-[#262320] flex items-center justify-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy PNG</span>
                </button>
                <button
                  type="button"
                  data-testid="print-sheet-export-btn"
                  disabled={Boolean(exportProgressTask?.active)}
                  onClick={handlePrintSheetDirectly}
                  className="min-h-[38px] px-2.5 py-1.5 text-[11px] font-medium text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-[#262320] flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  data-testid="share-export-btn"
                  disabled={Boolean(exportProgressTask?.active)}
                  onClick={handleNativeShare}
                  className="min-h-[38px] px-2.5 py-1.5 text-[11px] font-medium text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-[#262320] flex items-center justify-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Verified Output Result Receipt Card */}
            {lastExportResult && (
              <div
                data-testid="verified-output-result-card"
                className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#15803D] text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-semibold text-[#15803D] dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Last Output Result Ready</span>
                  </span>
                  <span className="font-mono text-[11px]">{lastExportResult.sizeKb}</span>
                </div>
                <div className="font-mono text-[11px] text-[#181615] dark:text-[#F5F2EB] truncate">
                  {lastExportResult.filename}
                </div>
                <div className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                  {lastExportResult.format} · {lastExportResult.qualityPct}% Quality ·{' '}
                  {lastExportResult.dpi} DPI · {lastExportResult.quantityLabel}
                </div>
                <div className="text-[10px] font-mono text-[#B44C32] dark:text-[#E06D53]">
                  {lastExportResult.tierLabel}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Camera Capture Modal — Permission requested ONLY when user explicitly clicks "Allow Camera & Start Stream" */}
      {cameraModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera Capture"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1C1A18] rounded-2xl max-w-md w-full p-5 space-y-4 border border-[#E7E2DA]">
            <div>
              <h3 className="text-base font-bold">Capture Directly to Device RAM</h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                Zero Startup Permissions: Varnank Studios never requests camera access on startup,
                Home, or Dashboard. Permission is requested only when you click Start Camera below.
              </p>
            </div>
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" playsInline />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={stopCameraStream}
                className="min-h-[40px] px-4 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg"
              >
                Cancel
              </button>
              {!cameraStreamActive ? (
                <button
                  type="button"
                  data-testid="request-camera-permission-btn"
                  onClick={requestCameraPermissionAndStartStream}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold bg-[#181615] text-white rounded-lg"
                >
                  Request Camera Permission &amp; Start Stream
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="capture-camera-frame-btn"
                  onClick={captureCameraFrame}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold bg-[#B44C32] text-white rounded-lg"
                >
                  Capture Photo to RAM
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
