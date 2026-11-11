import { StudioId } from './engine';

export interface CanvasRenderParams {
  studioId: StudioId;
  toolId: string;
  widthPx: number;
  heightPx: number;
  titleText: string;
  subtitleText: string;
  codeLabel: string;
  rotationDeg: number;
  brightness: number; // 50..150
  contrast: number; // 50..150
  saturation: number; // 0..200
  warmth: number; // -50..50
  backgroundStyle: 'WARM_PAPER' | 'PURE_WHITE' | 'LIGHT_BLUE_ID' | 'SLATE_GRID';
  showIdGuide: boolean;
  showPrintCropMarks: boolean;
  bleedMm: number;
  redactionBoxes: Array<{ xPct: number; yPct: number; wPct: number; hPct: number }>;
  idSheetCopies: 1 | 4 | 8 | 16;
  stampText: string;
  sourceImage: HTMLImageElement | null;
}

/**
 * Renders the current studio work item onto an HTMLCanvasElement 100% locally in the browser.
 * Never makes any network request; uses abstract geometric non-human visuals for sample previews (Section D).
 */
export function renderStudioCanvas(
  canvas: HTMLCanvasElement,
  params: CanvasRenderParams
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = params.widthPx;
  canvas.height = params.heightPx;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Background fill
  const bgMap: Record<CanvasRenderParams['backgroundStyle'], string> = {
    WARM_PAPER: '#FAF8F5',
    PURE_WHITE: '#FFFFFF',
    LIGHT_BLUE_ID: '#EBF3FA',
    SLATE_GRID: '#F1EFEA',
  };
  ctx.fillStyle = bgMap[params.backgroundStyle] || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle geometric grid if SLATE_GRID
  if (params.backgroundStyle === 'SLATE_GRID') {
    ctx.strokeStyle = 'rgba(24, 22, 21, 0.06)';
    ctx.lineWidth = 1;
    const step = Math.max(24, Math.round(canvas.width / 20));
    for (let x = step; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = step; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  // Apply filter adjustments
  ctx.filter = `brightness(${params.brightness}%) contrast(${params.contrast}%) saturate(${params.saturation}%)`;

  const renderSingleArtwork = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((params.rotationDeg * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);

    if (params.sourceImage) {
      // Fit user-loaded local file cleanly inside target bounds
      const scale = Math.min(w / params.sourceImage.width, h / params.sourceImage.height);
      const drawW = params.sourceImage.width * scale;
      const drawH = params.sourceImage.height * scale;
      ctx.drawImage(params.sourceImage, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
    } else {
      // Section D compliant abstract geometric non-human visual per studio
      if (params.studioId === 'S3') {
        // ID / Govt. ID Studio: Abstract geometric frame & alignment emblem (NO human/AI portrait)
        ctx.fillStyle = params.backgroundStyle === 'LIGHT_BLUE_ID' ? '#DCE8F5' : '#F3EFEA';
        ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
        ctx.strokeStyle = '#181615';
        ctx.lineWidth = Math.max(2, w * 0.008);
        ctx.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);

        // Abstract concentric geometric alignment target (strictly non-human)
        const cx = w * 0.5;
        const cy = h * 0.44;
        const rOuter = Math.min(w, h) * 0.24;
        ctx.strokeStyle = '#B44C32';
        ctx.lineWidth = Math.max(2, w * 0.01);
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - rOuter * 0.6, cy);
        ctx.lineTo(cx + rOuter * 0.6, cy);
        ctx.moveTo(cx, cy - rOuter * 0.6);
        ctx.lineTo(cx, cy + rOuter * 0.6);
        ctx.stroke();

        // Dimension & code plaque at bottom
        ctx.fillStyle = '#181615';
        ctx.fillRect(w * 0.14, h * 0.75, w * 0.72, h * 0.12);
        ctx.fillStyle = '#FAF8F5';
        ctx.font = `600 ${Math.max(11, Math.round(w * 0.045))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(params.codeLabel || 'Passport Size', cx, h * 0.825);
      } else if (params.studioId === 'S2') {
        // PDF Studio: Structured document sheet with geometric blocks
        const pad = w * 0.1;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
        ctx.strokeStyle = '#D5CFC4';
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

        // Header bar
        ctx.fillStyle = '#181615';
        ctx.fillRect(pad * 1.4, pad * 1.5, w - pad * 2.8, h * 0.06);

        ctx.fillStyle = '#FAF8F5';
        ctx.font = `600 ${Math.max(12, Math.round(w * 0.026))}px "JetBrains Mono", monospace`;
        ctx.fillText(params.codeLabel || 'Document Sheet', pad * 1.6, pad * 1.5 + h * 0.04);

        // Title & subtitle
        ctx.fillStyle = '#181615';
        ctx.font = `700 ${Math.max(16, Math.round(w * 0.036))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(params.titleText || 'Document Specification Sheet', pad * 1.4, pad * 2.8);

        ctx.fillStyle = '#57534E';
        ctx.font = `400 ${Math.max(12, Math.round(w * 0.022))}px "DM Sans", sans-serif`;
        ctx.fillText(params.subtitleText || 'Processed locally on your device', pad * 1.4, pad * 3.3);

        // Structured geometric content bars
        ctx.fillStyle = '#E7E2DA';
        for (let row = 0; row < 5; row++) {
          const ry = pad * 4.0 + row * (h * 0.075);
          ctx.fillRect(pad * 1.4, ry, (w - pad * 2.8) * (row % 2 === 0 ? 0.92 : 0.74), h * 0.028);
        }
      } else if (params.studioId === 'S4') {
        // Print & Publication Studio: Editorial layout card with geometric emblem
        const margin = w * 0.08;
        ctx.strokeStyle = '#181615';
        ctx.lineWidth = 2;
        ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

        ctx.fillStyle = '#B44C32';
        ctx.fillRect(margin, margin, w - margin * 2, h * 0.14);

        ctx.fillStyle = '#FAF8F5';
        ctx.font = `700 ${Math.max(14, Math.round(w * 0.035))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(params.titleText || 'Varnank Publication Layout', margin * 1.5, margin + h * 0.088);

        // Two-column abstract geometric vector diagram
        ctx.strokeStyle = '#181615';
        ctx.lineWidth = 2;
        ctx.strokeRect(margin * 1.5, h * 0.3, w * 0.36, h * 0.45);
        ctx.beginPath();
        ctx.moveTo(margin * 1.5, h * 0.3);
        ctx.lineTo(margin * 1.5 + w * 0.36, h * 0.75);
        ctx.stroke();

        ctx.fillStyle = '#181615';
        ctx.font = `500 ${Math.max(12, Math.round(w * 0.025))}px "DM Sans", sans-serif`;
        ctx.fillText(params.subtitleText || 'Archival Press Edition', w * 0.52, h * 0.36);

        ctx.fillStyle = '#D6D0C4';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(w * 0.52, h * 0.42 + i * (h * 0.07), w * 0.34, h * 0.03);
        }
      } else {
        // Photo/Image Studio abstract architectural geometry
        const pad = w * 0.08;
        ctx.fillStyle = '#EFECE6';
        ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);

        // Geometric composition (circles, golden-ratio rectangles, lines)
        ctx.fillStyle = '#B44C32';
        ctx.beginPath();
        ctx.arc(w * 0.38, h * 0.46, Math.min(w, h) * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#181615';
        ctx.fillRect(w * 0.46, h * 0.32, w * 0.32, h * 0.36);

        ctx.strokeStyle = '#FAF8F5';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * 0.32, h * 0.26, w * 0.36, h * 0.36);

        ctx.fillStyle = '#181615';
        ctx.font = `700 ${Math.max(15, Math.round(w * 0.034))}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(params.titleText || 'Varnank Visual Frame', pad * 1.4, h * 0.82);

        ctx.fillStyle = '#57534E';
        ctx.font = `500 ${Math.max(11, Math.round(w * 0.022))}px "JetBrains Mono", monospace`;
        ctx.fillText(`${params.codeLabel} · ${w}×${h}px`, pad * 1.4, h * 0.87);
      }
    }

    ctx.restore();
  };

  // 2. Render either single work item or gated Multi-Copy ID Print Sheet (4-up / 8-up / 16-up)
  if (params.studioId === 'S3' && params.idSheetCopies > 1) {
    const cols = params.idSheetCopies === 16 ? 4 : 2;
    const rows = params.idSheetCopies === 16 ? 4 : params.idSheetCopies === 8 ? 4 : 2;
    const padX = canvas.width * 0.06;
    const padY = canvas.height * 0.05;
    const gapX = canvas.width * 0.035;
    const gapY = canvas.height * 0.03;
    const cellW = (canvas.width - padX * 2 - gapX * (cols - 1)) / cols;
    const cellH = (canvas.height - padY * 2 - gapY * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = padX + c * (cellW + gapX);
        const cy = padY + r * (cellH + gapY);
        renderSingleArtwork(cx, cy, cellW, cellH);

        // Dashed scissor cut lines around each copy
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#78716C';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 3, cy - 3, cellW + 6, cellH + 6);
        ctx.restore();
      }
    }
  } else {
    renderSingleArtwork(0, 0, canvas.width, canvas.height);
  }

  ctx.filter = 'none';

  // 3. Warmth tint overlay if warmth != 0
  if (params.warmth !== 0) {
    ctx.fillStyle =
      params.warmth > 0
        ? `rgba(224, 109, 83, ${Math.min(0.22, params.warmth / 250)})`
        : `rgba(56, 130, 246, ${Math.min(0.22, Math.abs(params.warmth) / 250)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 4. ID Dimension Alignment Guide Overlay
  if (params.showIdGuide) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 76, 50, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    // Outer margin & center axis lines
    const insetX = canvas.width * 0.12;
    const insetY = canvas.height * 0.12;
    ctx.strokeRect(insetX, insetY, canvas.width - insetX * 2, canvas.height - insetY * 2);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, insetY);
    ctx.lineTo(canvas.width / 2, canvas.height - insetY);
    ctx.moveTo(insetX, canvas.height * 0.42);
    ctx.lineTo(canvas.width - insetX, canvas.height * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Permanent Redaction / Privacy Masking Boxes (Paid Tool T7 / T12)
  if (params.redactionBoxes.length > 0) {
    ctx.save();
    ctx.fillStyle = '#0B0A09';
    for (const box of params.redactionBoxes) {
      const rx = (box.xPct / 100) * canvas.width;
      const ry = (box.yPct / 100) * canvas.height;
      const rw = (box.wPct / 100) * canvas.width;
      const rh = (box.hPct / 100) * canvas.height;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
  }

  // 6. Stamp / Watermark Overlay
  if (params.stampText.trim()) {
    ctx.save();
    ctx.fillStyle = 'rgba(24, 22, 21, 0.78)';
    const badgeH = Math.max(28, Math.round(canvas.height * 0.045));
    ctx.fillRect(canvas.width * 0.06, canvas.height - badgeH - canvas.height * 0.04, canvas.width * 0.88, badgeH);
    ctx.fillStyle = '#FAF8F5';
    ctx.font = `600 ${Math.max(11, Math.round(badgeH * 0.48))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(
      params.stampText.trim(),
      canvas.width / 2,
      canvas.height - canvas.height * 0.04 - badgeH * 0.32
    );
    ctx.restore();
  }

  // 7. Print Bleed & Corner Crop Marks (Paid Tool T15)
  if (params.showPrintCropMarks) {
    ctx.save();
    const markOffset = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    const markLen = Math.max(14, Math.round(markOffset * 0.75));
    ctx.strokeStyle = '#181615';
    ctx.lineWidth = 1.5;

    const corners = [
      { x: markOffset, y: markOffset, dx: -1, dy: -1 },
      { x: canvas.width - markOffset, y: markOffset, dx: 1, dy: -1 },
      { x: markOffset, y: canvas.height - markOffset, dx: -1, dy: 1 },
      { x: canvas.width - markOffset, y: canvas.height - markOffset, dx: 1, dy: 1 },
    ];
    for (const c of corners) {
      ctx.beginPath();
      ctx.moveTo(c.x + c.dx * 4, c.y);
      ctx.lineTo(c.x + c.dx * (4 + markLen), c.y);
      ctx.moveTo(c.x, c.y + c.dy * 4);
      ctx.lineTo(c.x, c.y + c.dy * (4 + markLen));
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Generates a valid, self-contained single-page PDF document directly in browser memory
 * wrapping the rendered JPEG bytes from the canvas at the specified quality and DPI (100% client-side, zero upload).
 */
export async function exportCanvasAsLocalPdfBlob(
  canvas: HTMLCanvasElement,
  qualityPct = 92,
  dpi = 150
): Promise<Blob> {
  const normalizedQuality = Math.min(1, Math.max(0.5, qualityPct / 100));
  const dataUrl = canvas.toDataURL('image/jpeg', normalizedQuality);
  const base64 = dataUrl.split(',')[1] || '';
  const binaryStr = atob(base64);
  const imgBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    imgBytes[i] = binaryStr.charCodeAt(i);
  }

  const effectiveDpi = Math.max(72, dpi);
  const wPt = Math.max(72, Math.round((canvas.width * 72) / effectiveDpi));
  const hPt = Math.max(72, Math.round((canvas.height * 72) / effectiveDpi));

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const pushText = (str: string) => {
    const arr = encoder.encode(str);
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const markObj = () => {
    offsets.push(byteLength);
  };

  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // 1: Catalog
  markObj();
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  markObj();
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  markObj();
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // 4: Image XObject
  markObj();
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.byteLength} >>\nstream\n`
  );
  pushBytes(imgBytes);
  pushText('\nendstream\nendobj\n');

  // 5: Content stream
  const contentStream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im0 Do\nQ\n`;
  markObj();
  pushText(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLength;
  pushText(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    pushText(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

/**
 * Generates a self-contained scalable SVG vector sheet wrapping the current canvas artwork
 * and vector crop/registration geometry (100% client-side, zero upload).
 */
export function exportCanvasAsLocalSvgBlob(
  canvas: HTMLCanvasElement,
  codeLabel: string,
  dpi = 300
): Blob {
  const pngDataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" data-dpi="${dpi}" data-code="${codeLabel.replace(/"/g, '')}">
  <title>Varnank Studios Local SVG Export (${codeLabel} · ${dpi} DPI)</title>
  <image href="${pngDataUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
  return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Generates an uncompressed store-mode ZIP archive in browser memory for batch downloads.
 */
export function createBrowserZipBlob(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  const crc32 = (buf: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.byteLength;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.byteLength + size;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.byteLength, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd] as unknown as BlobPart[], {
    type: 'application/zip',
  });
}
