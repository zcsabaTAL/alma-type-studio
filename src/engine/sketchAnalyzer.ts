import { ConstructionParams, SketchAnalysisResult } from '../types/font';

/**
 * Real client-side Canvas image processor:
 * Separates dark pen ink from white paper OR colored sticky notes (like coral Post-it),
 * measures ink coverage, bounding box aspect ratio, and italic slant angle via image moments.
 */
export async function analyzeSketchImage(
  imageUrl: string,
  fileName: string
): Promise<SketchAnalysisResult> {
  const img = await loadImage(imageUrl);

  const targetW = 360;
  const scale = Math.min(1, targetW / img.width);
  const w = Math.max(64, Math.round(img.width * scale));
  const h = Math.max(64, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Sample central region (avoiding desk outside Post-it) to estimate paper/Post-it background color
  const samplesR: number[] = [];
  const samplesG: number[] = [];
  const samplesB: number[] = [];
  const xStart = Math.floor(w * 0.12);
  const xEnd = Math.floor(w * 0.88);
  const yStart = Math.floor(h * 0.25);
  const yEnd = Math.floor(h * 0.78);

  for (let y = yStart; y < yEnd; y += 3) {
    for (let x = xStart; x < xEnd; x += 3) {
      const idx = (y * w + x) * 4;
      samplesR.push(data[idx]);
      samplesG.push(data[idx + 1]);
      samplesB.push(data[idx + 2]);
    }
  }
  samplesR.sort((a, b) => a - b);
  samplesG.sort((a, b) => a - b);
  samplesB.sort((a, b) => a - b);

  // Median color of central region = paper / Post-it note color
  const mid = Math.floor(samplesR.length / 2);
  const bgR = samplesR[mid] ?? 240;
  const bgG = samplesG[mid] ?? 240;
  const bgB = samplesB[mid] ?? 240;
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  // Build binary ink mask inside the active central region
  const mask = new Uint8Array(w * h);
  let inkCount = 0;
  let totalArea = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      totalArea++;
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      const colorDist = Math.hypot(r - bgR, g - bgG, b - bgB);
      const isDarker = lum < bgLum - 38;
      const isInk = isDarker && colorDist > 52;

      if (isInk) {
        mask[y * w + x] = 1;
        inkCount++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Estimate slant via central moments (mu11 / mu02) on local ink strokes
  let estimatedSlantDeg = 12;
  if (inkCount > 40) {
    const cx = sumX / inkCount;
    const cy = sumY / inkCount;
    let mu11 = 0;
    let mu02 = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!mask[y * w + x]) continue;
        const dx = x - cx;
        const dy = y - cy;
        mu11 += dx * dy;
        mu02 += dy * dy;
      }
    }
    const rawAngle = Math.atan2(-mu11, mu02 + 1e-6) * (180 / Math.PI);
    estimatedSlantDeg = Math.max(-18, Math.min(24, Math.round(rawAngle * 10) / 10));
  }

  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const aspectRatio = Math.round((boxW / boxH) * 100) / 100;
  const inkCoverage = Math.round((inkCount / Math.max(1, totalArea)) * 1000) / 10;
  const strokeDensity = Math.round((inkCount / Math.max(1, boxW * boxH)) * 100);

  // Render cropped high-contrast extracted ink preview
  const pad = 12;
  const cx0 = Math.max(0, minX - pad);
  const cy0 = Math.max(0, minY - pad);
  const cw = Math.max(32, Math.min(w - cx0, boxW + pad * 2));
  const ch = Math.max(32, Math.min(h - cy0, boxH + pad * 2));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cw;
  outCanvas.height = ch;
  const outCtx = outCanvas.getContext('2d');
  let tracePreviewDataUrl = imageUrl;

  if (outCtx) {
    const outImg = outCtx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const isInk = mask[(cy0 + y) * w + (cx0 + x)] === 1;
        const oIdx = (y * cw + x) * 4;
        if (isInk) {
          // Coral-amber glowing ink vector silhouette
          outImg.data[oIdx] = 255;
          outImg.data[oIdx + 1] = 114;
          outImg.data[oIdx + 2] = 86;
          outImg.data[oIdx + 3] = 255;
        } else {
          outImg.data[oIdx] = 18;
          outImg.data[oIdx + 1] = 19;
          outImg.data[oIdx + 2] = 24;
          outImg.data[oIdx + 3] = 255;
        }
      }
    }
    outCtx.putImageData(outImg, 0, 0);
    tracePreviewDataUrl = outCanvas.toDataURL('image/png');
  }

  return {
    imageUrl,
    fileName,
    inkCoverage,
    estimatedSlantDeg,
    aspectRatio,
    strokeDensity,
    tracePreviewDataUrl,
  };
}

export function mapAnalysisToParams(
  analysis: SketchAnalysisResult,
  current: ConstructionParams
): ConstructionParams {
  const strokeWeight = Math.max(22, Math.min(68, Math.round(24 + analysis.strokeDensity * 1.6)));
  const exaggeration = Math.max(
    20,
    Math.min(90, Math.round(35 + Math.abs(analysis.estimatedSlantDeg) * 2.4))
  );
  const jointMelt = analysis.strokeDensity > 22 ? 42 : 20;
  return {
    ...current,
    strokeWeight,
    exaggeration,
    jointMelt,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
