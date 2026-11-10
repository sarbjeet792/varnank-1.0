import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StudioId,
  StudioToolDefinition,
  PresetDefinition,
  evaluateDeviceMemoryGuard,
} from '../core/engine';
import {
  CanvasRenderParams,
  renderStudioCanvas,
  exportCanvasAsLocalPdfBlob,
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
  Sparkles,
  Sliders,
  FileText,
  Layers,
  Check,
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

interface StudioWorkspaceProps {
  studios: Array<{ id: StudioId; codeLabel: string; name: string; summary: string }>;
  tools: StudioToolDefinition[];
  presets: PresetDefinition[];
  userCustomPresets: PresetDefinition[];
  onSaveLocalPreset: (preset: PresetDefinition) => void;
  sessionToken: string | null;
  entitlementToken: string | null;
  onRequestUpgrade: () => void;
  onRecordLocalActivity: (entry: LocalActivityEntry) => void;
  onWipeAllLocalData: () => void;
  defaultExportFormat?: 'PNG' | 'JPEG' | 'WEBP' | 'PDF';
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
  idSheetCopies: 1 | 4 | 8;
  stampText: string;
}

const DEFAULT_SNAPSHOT: EditorSnapshot = {
  widthPx: 800,
  heightPx: 600,
  titleText: 'Varnank Visual Specification',
  subtitleText: 'Processed 100% on your device',
  codeLabel: 'S1-FRAME',
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
  onRequestUpgrade,
  onRecordLocalActivity,
  onWipeAllLocalData,
  defaultExportFormat = 'PNG',
}) => {
  const [selectedStudioId, setSelectedStudioId] = useState<StudioId>('S1');
  const [selectedToolId, setSelectedToolId] = useState<string>('T1');
  const [unlockedBundles, setUnlockedBundles] = useState<Record<string, boolean>>({});
  const [bundleStatusMessage, setBundleStatusMessage] = useState<string | null>(null);

  // 20-step Undo/Redo Stack (Category G)
  const [history, setHistory] = useState<EditorSnapshot[]>([DEFAULT_SNAPSHOT]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const currentSnap = history[historyIndex] || DEFAULT_SNAPSHOT;

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [loadedFileLabel, setLoadedFileLabel] = useState<string | null>(null);
  const [ramWarning, setRamWarning] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'PNG' | 'JPEG' | 'WEBP' | 'PDF' | 'ZIP'>(
    defaultExportFormat
  );
  const [batchCount, setBatchCount] = useState<number>(4);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [customPresetName, setCustomPresetName] = useState<string>('');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const studioTools = tools.filter((t) => t.studioId === selectedStudioId);
  const allPresets = [...presets, ...userCustomPresets].filter(
    (p) => p.studioId === selectedStudioId
  );
  const activeTool = tools.find((t) => t.id === selectedToolId) || studioTools[0];

  const pushSnapshot = useCallback(
    (updater: (prev: EditorSnapshot) => EditorSnapshot) => {
      setHistory((prevHist) => {
        const base = prevHist[historyIndex] || DEFAULT_SNAPSHOT;
        const nextSnap = updater(base);
        const sliced = prevHist.slice(0, historyIndex + 1);
        const appended = [...sliced, nextSnap];
        // Enforce 20-step max stack
        if (appended.length > 20) appended.shift();
        setHistoryIndex(appended.length - 1);
        return appended;
      });
    },
    [historyIndex]
  );

  // Automatic memory wipe when leaving ID/Govt. ID Studio (S3) per Decision Log G1
  const switchStudio = (nextStudioId: StudioId) => {
    if (selectedStudioId === 'S3' && nextStudioId !== 'S3') {
      setSourceImage(null);
      setLoadedFileLabel(null);
      setStatusFeedback('ID Studio temporary memory buffer automatically wiped on close.');
    }

    setSelectedStudioId(nextStudioId);
    const firstTool = tools.find((t) => t.studioId === nextStudioId);
    if (firstTool) setSelectedToolId(firstTool.id);

    const defaultsByStudio: Record<StudioId, Partial<EditorSnapshot>> = {
      S1: {
        widthPx: 800,
        heightPx: 600,
        codeLabel: 'S1-FRAME',
        titleText: 'Studio S1 Visual Frame',
        subtitleText: 'Processed locally on your device',
        backgroundStyle: 'WARM_PAPER',
        showIdGuide: false,
        showPrintCropMarks: false,
        idSheetCopies: 1,
      },
      S2: {
        widthPx: 720,
        heightPx: 960,
        codeLabel: 'DOC-S2',
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
        codeLabel: 'ID-P1 (35×45mm)',
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
        codeLabel: 'PUB-P7',
        titleText: 'Publication Layout Card P7',
        subtitleText: 'Edition Code: PUB-S4-01',
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
  };

  // Check gated Paid bundle access with the Control Plane when selecting a Paid/Premium tool (Section E)
  const handleSelectTool = async (tool: StudioToolDefinition) => {
    setSelectedToolId(tool.id);
    setBundleStatusMessage(null);

    if (tool.tier === 'FREE' || !tool.bundleId) {
      return;
    }

    if (!sessionToken || !entitlementToken) {
      setBundleStatusMessage(
        'This tool is part of a paid studio bundle. Upgrade to an active plan to unlock it.'
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
        setBundleStatusMessage('Paid tool bundle verified and loaded into browser memory.');
      } else {
        setUnlockedBundles((prev) => ({ ...prev, [tool.bundleId!]: false }));
        setBundleStatusMessage(
          data.error || 'Upgrade to an active plan to unlock this studio tool.'
        );
      }
    } catch {
      setBundleStatusMessage('Unable to verify bundle access right now. Ref: ERR-B500');
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

  // Re-render canvas locally whenever snapshot or sourceImage changes
  useEffect(() => {
    if (!canvasRef.current) return;
    renderStudioCanvas(canvasRef.current, {
      studioId: selectedStudioId,
      toolId: selectedToolId,
      ...currentSnap,
      sourceImage,
    });
  }, [selectedStudioId, selectedToolId, currentSnap, sourceImage]);

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
        setSourceImage(img);
        setLoadedFileLabel(`${file.name} (${(file.size / 1024).toFixed(1)} KB · Local Only)`);
        setStatusFeedback('File loaded into browser memory. Zero bytes sent over network.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const applyPreset = (preset: PresetDefinition) => {
    if (preset.tier === 'PAID') {
      const anyPaidUnlocked = Object.values(unlockedBundles).some(Boolean);
      if (!anyPaidUnlocked) {
        setBundleStatusMessage(
          `Preset "${preset.name}" requires an active paid plan. Click Upgrade to unlock.`
        );
        return;
      }
    }

    pushSnapshot((prev) => ({
      ...prev,
      widthPx: preset.widthPx,
      heightPx: preset.heightPx,
      codeLabel: preset.codeLabel,
      bleedMm: preset.bleedMm,
      showPrintCropMarks: preset.bleedMm > 0,
      idSheetCopies: preset.id === 'P4' ? 8 : prev.idSheetCopies,
    }));
    setStatusFeedback(`Applied ${preset.codeLabel}: ${preset.name}`);
  };

  const handleCloseAndWipeCurrentBuffer = () => {
    setSourceImage(null);
    setLoadedFileLabel(null);
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
    setStatusFeedback('Temporary working buffer and undo stack wiped from browser memory.');
  };

  const handleExportOutput = async () => {
    if (!canvasRef.current) return;

    // Check daily export allowance on Control Plane (zero file bytes sent)
    try {
      const resp = await fetch('/api/entitlements/record-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok || !data.allowed) {
        setStatusFeedback(data.error || 'Daily export limit reached.');
        return;
      }
    } catch {
      // Allow local export if offline
    }

    const studioMeta = studios.find((s) => s.id === selectedStudioId);
    const filenameBase = `varnank-${selectedStudioId.toLowerCase()}-${currentSnap.codeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`;

    let blob: Blob | null = null;
    let ext = exportFormat.toLowerCase();

    if (exportFormat === 'PDF') {
      blob = await exportCanvasAsLocalPdfBlob(canvasRef.current);
      ext = 'pdf';
    } else if (exportFormat === 'ZIP') {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const b64 = dataUrl.split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      const batchFiles = Array.from({ length: batchCount }, (_, idx) => ({
        name: `${filenameBase}-item-${idx + 1}.png`,
        data: bytes,
      }));
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
        canvasRef.current!.toBlob((b) => resolve(b), mime, 0.92)
      );
    }

    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    onRecordLocalActivity({
      id: `ACT-${Date.now()}`,
      studioId: selectedStudioId,
      studioName: studioMeta?.name || selectedStudioId,
      toolName: activeTool?.name || 'Studio Export',
      presetCode: currentSnap.codeLabel,
      exportFormat,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setStatusFeedback(`Saved ${filenameBase}.${ext} directly to your device.`);
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current || !navigator.share) {
      setStatusFeedback('Direct share is available on supported mobile browsers; use Download.');
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

  const startCameraCapture = async () => {
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setStatusFeedback('Camera access was not granted or no camera was found on this device.');
      setCameraModalOpen(false);
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
        setLoadedFileLabel('Camera Capture (Local Device RAM Only)');
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
    setCameraModalOpen(false);
  };

  const isCurrentToolLocked =
    activeTool &&
    activeTool.tier !== 'FREE' &&
    (!activeTool.bundleId || !unlockedBundles[activeTool.bundleId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-12">
      {/* Text-Led Editorial Header (Section D: Strictly NO Hero Picture & NO Pane Directly Below It) */}
      <section className="pb-6 border-b border-[#E7E2DA] dark:border-[#2E2B28]">
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
            <button
              type="button"
              onClick={handleCloseAndWipeCurrentBuffer}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-[#181615] dark:text-[#F5F2EB] bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#B44C32]" />
              <span>Wipe Working Buffer</span>
            </button>
            <button
              type="button"
              onClick={onWipeAllLocalData}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-[#B91C1C] dark:text-[#F87171] bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors whitespace-nowrap"
            >
              Wipe Local Device Data
            </button>
          </div>
        </div>

        {/* 4 Studio Switcher Tabs (Functional Interactive Segmented Control) */}
        <div
          role="tablist"
          aria-label="Select Studio"
          className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
        >
          {studios.map((studio) => {
            const active = studio.id === selectedStudioId;
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
                  <span>Local Only</span>
                </div>
                <div className="font-semibold text-sm">{studio.name}</div>
                <p className="text-xs opacity-80 mt-1 line-clamp-2">{studio.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

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

      {/* 3-Zone Responsive Studio Editor (Category H) */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT ZONE (3 cols on lg): Studio Tools & Local Presets */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
            <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E] mb-3">
              Studio Tools ({selectedStudioId})
            </h2>
            <div className="space-y-2">
              {studioTools.map((tool) => {
                const isSelected = tool.id === selectedToolId;
                const isUnlocked =
                  tool.tier === 'FREE' || (tool.bundleId && unlockedBundles[tool.bundleId]);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleSelectTool(tool)}
                    className={`w-full p-3 rounded-lg text-left transition-colors border ${
                      isSelected
                        ? 'bg-[#FAF8F5] dark:bg-[#262320] border-[#B44C32]'
                        : 'bg-transparent border-[#E7E2DA] dark:border-[#2E2B28] hover:bg-[#FAF8F5]/60 dark:hover:bg-[#262320]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                      <span className="font-mono">{tool.codeLabel}</span>
                      <span>
                        {isUnlocked ? (
                          'Ready'
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#B44C32] dark:text-[#E06D53]">
                            <Lock className="w-3 h-3" />
                            <span>{tool.tier === 'PREMIUM' ? 'Premium' : 'Paid'}</span>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                      {tool.name}
                    </div>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                      {tool.plainDescription}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Presets Selector for Current Studio */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
            <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E] mb-3">
              Presets &amp; Standard Sizes
            </h2>
            <div className="space-y-2">
              {allPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="w-full p-2.5 rounded-lg text-left border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
                    <span>{preset.codeLabel}</span>
                    <span>{preset.tier === 'PAID' ? 'Paid Preset' : 'Free'}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-[#57534E] dark:text-[#A8A29E] font-mono">
                    {preset.dimensionsLabel}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER ZONE (6 cols on lg): Interactive Canvas, File Dropzone & Undo/Redo Toolbar */}
        <section className="lg:col-span-6 space-y-4">
          {/* Top Editor Action Bar */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Open File</span>
              </button>
              <button
                type="button"
                onClick={startCameraCapture}
                className="min-h-[40px] px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:border-[#B44C32] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera</span>
              </button>
            </div>

            {/* 20-step Undo / Redo & Zoom */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Undo step"
                disabled={historyIndex <= 0}
                onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] disabled:opacity-40 flex items-center gap-1"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="font-mono">{historyIndex}</span>
              </button>
              <button
                type="button"
                aria-label="Redo step"
                disabled={historyIndex >= history.length - 1}
                onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
                className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] disabled:opacity-40 flex items-center gap-1"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <select
                aria-label="Canvas Zoom"
                value={zoomPct}
                onChange={(e) => setZoomPct(Number(e.target.value))}
                className="min-h-[40px] px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg"
              >
                <option value={75}>75%</option>
                <option value={100}>100%</option>
                <option value={125}>125%</option>
              </select>
            </div>
          </div>

          {/* Locked Paid Tool Banner (Plain-Language "Upgrade to unlock" per Principle 5 & Phase 3) */}
          {isCurrentToolLocked && (
            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#B44C32] dark:text-[#E06D53]">
                  Locked Paid Studio Bundle · {activeTool.codeLabel}
                </div>
                <h3 className="text-base font-bold text-[#181615] dark:text-[#F5F2EB] mt-0.5">
                  {activeTool.name} — Upgrade to unlock
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                  {bundleStatusMessage ||
                    'This tool is delivered only to accounts with a confirmed active plan.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onRequestUpgrade}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg whitespace-nowrap shrink-0"
              >
                Upgrade to unlock
              </button>
            </div>
          )}

          {/* Drag-and-Drop Interactive Canvas Surface */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleLocalFileLoad(file);
            }}
            className="p-6 rounded-xl bg-[#F1EFEA] dark:bg-[#181615] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col items-center justify-center min-h-[420px] overflow-auto"
          >
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
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
              <span>
                {currentSnap.widthPx} × {currentSnap.heightPx} px
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentSnap.codeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{loadedFileLabel || 'Drag & drop, paste (Ctrl+V), or open a file'}</span>
            </div>
          </div>
        </section>

        {/* RIGHT ZONE (3 cols on lg): Parameter Controls, Save Local Preset & Export */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
            <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Dimensions &amp; Adjustments</span>
            </h2>

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
                  max={2400}
                  value={currentSnap.widthPx}
                  onChange={(e) =>
                    pushSnapshot((p) => ({
                      ...p,
                      widthPx: Math.min(2400, Math.max(100, Number(e.target.value) || 400)),
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
                  max={2400}
                  value={currentSnap.heightPx}
                  onChange={(e) =>
                    pushSnapshot((p) => ({
                      ...p,
                      heightPx: Math.min(2400, Math.max(100, Number(e.target.value) || 400)),
                    }))
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
                />
              </div>
            </div>

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

              {/* Gated Paid Features: Multi-ID Print Sheet, PDF Redaction, Print Crop Marks */}
              {!isCurrentToolLocked && activeTool.tier !== 'FREE' && (
                <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#B44C32]/40 space-y-2.5">
                  <div className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53]">
                    Unlocked Pro Bundle Controls
                  </div>

                  {selectedStudioId === 'S3' && (
                    <div>
                      <label
                        htmlFor="select-id-copies"
                        className="block text-xs text-[#57534E] mb-1"
                      >
                        Multi-Copy Print Sheet Layout
                      </label>
                      <select
                        id="select-id-copies"
                        value={currentSnap.idSheetCopies}
                        onChange={(e) => {
                          const copies = Number(e.target.value) as 1 | 4 | 8;
                          pushSnapshot((p) => ({
                            ...p,
                            idSheetCopies: copies,
                            showIdGuide: copies === 1,
                            widthPx: copies > 1 ? 800 : 413,
                            heightPx: copies > 1 ? 1120 : 531,
                          }));
                        }}
                        className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA]"
                      >
                        <option value={1}>Single ID Photo (1-up)</option>
                        <option value={4}>4-Copy Print Sheet (with Cut Lines)</option>
                        <option value={8}>8-Copy A4/4×6 Sheet (with Cut Lines)</option>
                      </select>
                    </div>
                  )}

                  {(selectedStudioId === 'S2' || selectedStudioId === 'S3') && (
                    <button
                      type="button"
                      onClick={() =>
                        pushSnapshot((p) => ({
                          ...p,
                          redactionBoxes:
                            p.redactionBoxes.length > 0
                              ? []
                              : [
                                  { xPct: 14, yPct: 54, wPct: 52, hPct: 8 },
                                  { xPct: 14, yPct: 68, wPct: 38, hPct: 6 },
                                ],
                        }))
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium rounded bg-[#181615] text-white"
                    >
                      {currentSnap.redactionBoxes.length > 0
                        ? 'Clear Redaction Blocks'
                        : 'Apply Permanent Redaction Mask'}
                    </button>
                  )}

                  {selectedStudioId === 'S4' && (
                    <button
                      type="button"
                      onClick={() =>
                        pushSnapshot((p) => ({
                          ...p,
                          showPrintCropMarks: !p.showPrintCropMarks,
                        }))
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium rounded bg-[#181615] text-white"
                    >
                      {currentSnap.showPrintCropMarks
                        ? 'Hide Press Crop & Bleed Marks'
                        : 'Add 3mm Bleed & Corner Crop Marks'}
                    </button>
                  )}

                  <div>
                    <label htmlFor="input-stamp" className="block text-xs text-[#57534E] mb-1">
                      Batch Stamp / Watermark Label
                    </label>
                    <input
                      id="input-stamp"
                      type="text"
                      placeholder="e.g. APPROVED · COPY-01"
                      value={currentSnap.stampText}
                      onChange={(e) => pushSnapshot((p) => ({ ...p, stampText: e.target.value }))}
                      className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Custom Local Preset (Decision Log F1) */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2.5">
            <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E]">
              Save Custom Local Preset
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Custom preset name"
                placeholder="Preset label (e.g. P-Custom)"
                value={customPresetName}
                onChange={(e) => setCustomPresetName(e.target.value)}
                className="flex-1 min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!customPresetName.trim()) return;
                  const newP: PresetDefinition = {
                    id: `LOCAL-${Date.now()}`,
                    codeLabel: `USR-P${userCustomPresets.length + 1}`,
                    studioId: selectedStudioId,
                    category: 'SIZE',
                    name: customPresetName.trim(),
                    dimensionsLabel: `${currentSnap.widthPx} × ${currentSnap.heightPx} px · Local`,
                    widthPx: currentSnap.widthPx,
                    heightPx: currentSnap.heightPx,
                    dpi: 300,
                    bleedMm: currentSnap.bleedMm,
                    tier: 'FREE',
                    isGlobal: false,
                  };
                  onSaveLocalPreset(newP);
                  setCustomPresetName('');
                  setStatusFeedback(`Saved custom preset "${newP.name}" on your device.`);
                }}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </div>

          {/* Export & Download Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
            <h2 className="text-xs font-semibold tracking-tight text-[#57534E] dark:text-[#A8A29E]">
              Export to Your Device
            </h2>
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
                onChange={(e) =>
                  setExportFormat(e.target.value as 'PNG' | 'JPEG' | 'WEBP' | 'PDF' | 'ZIP')
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                <option value="PNG">PNG (Lossless Visual)</option>
                <option value="JPEG">JPEG (Compact Photo)</option>
                <option value="WEBP">WebP (High Efficiency)</option>
                <option value="PDF">PDF (Print-Ready Sheet / Doc)</option>
                <option value="ZIP">ZIP Archive (Batch Output)</option>
              </select>
            </div>

            {exportFormat === 'ZIP' && (
              <div>
                <label htmlFor="input-batch-count" className="block text-xs text-[#57534E] mb-1">
                  Batch Copies in Archive
                </label>
                <input
                  id="input-batch-count"
                  type="number"
                  min={2}
                  max={20}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.min(20, Math.max(2, Number(e.target.value))))}
                  className="w-full min-h-[38px] px-3 py-1 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportOutput}
                className="w-full min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download {exportFormat} Now</span>
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full min-h-[40px] px-4 py-2 text-xs font-medium text-[#181615] dark:text-[#F5F2EB] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-[#262320] transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share via Device Sheet</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Camera Capture Modal */}
      {cameraModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera Capture"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1C1A18] rounded-2xl max-w-md w-full p-5 space-y-4 border border-[#E7E2DA]">
            <h3 className="text-base font-bold">Capture Directly to Device RAM</h3>
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" playsInline />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={stopCameraStream}
                className="min-h-[40px] px-4 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureCameraFrame}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold bg-[#B44C32] text-white rounded-lg"
              >
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
