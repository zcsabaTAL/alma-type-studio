import {
  BezierContour,
  BezierPoint,
  ConstructionParams,
  GlyphData,
} from '../types/font';
import { GLYPH_BLUEPRINTS, StrokeBlueprint } from './glyphBlueprints';

export const UPM = 1000;
export const CAP_HEIGHT = 740;
export const ASCENDER = 960;
export const DESCENDER = -240;

interface Segment2D {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ra: number;
  rb: number;
  isDiacritic: boolean;
  isCounter: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Deterministic pseudo-random in [-1, 1] from seed
function hashSigned(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}

// Polynomial smooth minimum for true organic "Joint melt"
function smin(a: number, b: number, k: number): number {
  if (k <= 0.001) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Signed distance from point (px, py) to a linearly tapered capsule segment
function sdTaperedCapsule(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ra: number,
  rb: number
): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const lenSq = bax * bax + bay * bay;
  const h = lenSq > 1e-6 ? Math.max(0, Math.min(1, (pax * bax + pay * bay) / lenSq)) : 0;
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const r = ra + (rb - ra) * h;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

function subdividePolyline(pts: [number, number][], subdivisions = 2): [number, number][] {
  if (pts.length <= 2) {
    if (pts.length === 2 && subdivisions > 0) {
      const [a, b] = pts;
      const out: [number, number][] = [a];
      const count = 4;
      for (let i = 1; i < count; i++) {
        const t = i / count;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      out.push(b);
      return out;
    }
    return pts;
  }
  // Chaikin-like smooth subdivision keeping endpoints exact
  let cur = pts;
  for (let pass = 0; pass < subdivisions; pass++) {
    const next: [number, number][] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const p0 = cur[i];
      const p1 = cur[i + 1];
      if (i > 0) {
        next.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25]);
      }
      if (i < cur.length - 2) {
        next.push([p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75]);
      }
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

function buildSegmentsForGlyph(
  char: string,
  params: ConstructionParams
): { segments: Segment2D[]; advanceWidth: number } {
  const bp = GLYPH_BLUEPRINTS[char] ?? GLYPH_BLUEPRINTS['A'];
  if (!bp || bp.strokes.length === 0) {
    return {
      segments: [],
      advanceWidth: Math.round((bp?.width ?? 0.34) * CAP_HEIGHT + 40),
    };
  }

  const unicode = char.codePointAt(0) ?? 65;
  const exag = params.exaggeration / 100; // 0..1
  const variation = params.pieceVariation / 100; // 0..1
  const counterPinch = params.counterPinch / 100; // 0..1
  const limbDrop = params.limbDrop / 100; // -0.4..1.0
  const bounce = params.baselineBounce / 100; // 0..1
  const waistShift = (params.waistHeight - 50) / 100; // -0.3..+0.3
  const baseRadius = params.strokeWeight * 0.5;

  // Signature ALMA forward slant (derived from Zoli's ~12 deg italic Post-it sketch)
  const slantActive = params.activePieces['stem-left'] ? 1 : 0.35;
  const slantSlope = (0.12 + exag * 0.16) * slantActive;

  // Slight horizontal condensation from exaggeration
  const widthScale = 1.0 - exag * 0.1;
  const glyphW = bp.width * CAP_HEIGHT * widthScale;

  // Per-glyph baseline bounce & micro-rotation
  const glyphBounceY = hashSigned(unicode * 3.17) * bounce * 52;
  const glyphTiltRad = hashSigned(unicode * 7.31) * bounce * 0.055;
  const cosT = Math.cos(glyphTiltRad);
  const sinT = Math.sin(glyphTiltRad);
  const pivotX = glyphW * 0.5 + 55;
  const pivotY = CAP_HEIGHT * 0.45;

  const sidebearing = 58 + baseRadius * 0.55;
  const segments: Segment2D[] = [];

  bp.strokes.forEach((stroke: StrokeBlueprint, sIdx: number) => {
    const pieceKey = stroke.piece;
    const isPieceEnabled =
      pieceKey === 'curve' || pieceKey === 'diacritic'
        ? true
        : params.activePieces[pieceKey];

    // If apex-spike piece is disabled, skip the extra overhanging apex accent
    if (pieceKey === 'apex-spike' && !isPieceEnabled) {
      return;
    }

    const rawPts = stroke.pts.map((p) => [p[0], p[1]] as [number, number]);

    // Apply semantic deformations in normalized space
    const transformedNorm: [number, number][] = rawPts.map(([nx, ny], pIdx) => {
      let x = nx;
      let y = ny;

      // Waist height shift
      if (stroke.waistInfluence) {
        y += waistShift * 0.36 * stroke.waistInfluence;
      }

      // Signature rising crossbar / kicked foot tilt from ALMA Post-it
      if (stroke.riseSlope) {
        const allowRise =
          (pieceKey === 'crossbar-rise' && params.activePieces['crossbar-rise']) ||
          (pieceKey === 'foot-kick' && params.activePieces['foot-kick']);
        const t = rawPts.length > 1 ? pIdx / (rawPts.length - 1) : 0;
        if (allowRise) {
          // Amplify upward tilt on right end
          y += (t - 0.15) * stroke.riseSlope * (0.04 + exag * 0.14);
        } else {
          // Flatten tilt when piece is toggled off
          const y0 = rawPts[0][1];
          y = y0 + (y - y0) * 0.15;
        }
      }

      // Limb drop on descenders and asymmetric right legs
      if (stroke.limbDropEnd) {
        const isStart = pIdx === 0;
        const isEnd = pIdx === rawPts.length - 1;
        if (
          (stroke.limbDropEnd === 'start' && isStart) ||
          (stroke.limbDropEnd === 'end' && isEnd) ||
          (stroke.limbDropEnd === 'both' && (isStart || isEnd))
        ) {
          y -= limbDrop * 0.18;
        }
      }

      // Counter pinch narrows interior loops horizontally/inward
      if (stroke.isCounter && counterPinch > 0) {
        const cx = bp.width * 0.5;
        x = cx + (x - cx) * (1 - counterPinch * 0.18);
      }

      // Piece variation: subtle organic hand-sketched wobble
      if (variation > 0 && !stroke.isDiacritic) {
        const seed = unicode * 19 + sIdx * 7 + pIdx * 13;
        x += hashSigned(seed) * variation * 0.028;
        y += hashSigned(seed + 101) * variation * 0.024;
      }

      return [x, y];
    });

    const densePts = subdividePolyline(transformedNorm, stroke.pts.length > 3 ? 1 : 2);

    // Compute per-point coordinates in Y-up em-square space + tapered radius
    const worldPts: [number, number, number][] = densePts.map(([nx, ny], i) => {
      const t = densePts.length > 1 ? i / (densePts.length - 1) : 0.5;

      // Scale to em-square
      let x = sidebearing + nx * CAP_HEIGHT * widthScale;
      let y = ny * CAP_HEIGHT + glyphBounceY;

      // Apply forward italic slant (pivoted around baseline)
      x += y * slantSlope;

      // Apply subtle baseline-bounce micro-tilt
      if (bounce > 0.01) {
        const dx = x - pivotX;
        const dy = y - pivotY;
        x = pivotX + dx * cosT - dy * sinT;
        y = pivotY + dx * sinT + dy * cosT;
      }

      // Radius profile (tapered needle-sharp terminals when pieces active!)
      const wScale = stroke.weightScale ?? 1.0;
      let taperMult = 1.0;

      const sharpFactor =
        (pieceKey === 'stem-right' && !params.activePieces['stem-right']) ||
        (pieceKey === 'diag-plunge' && !params.activePieces['diag-plunge'])
          ? 0.45
          : 1.0;

      if (stroke.taper === 'sharp') {
        // Thick organic belly in the center, razor-sharp tips at both ends (like ALMA pen sketch!)
        const bell = Math.sin(t * Math.PI);
        const tipFloor = Math.max(0.24, 0.58 - exag * 0.28 * sharpFactor);
        taperMult = tipFloor + (1.16 - tipFloor) * Math.pow(bell, 0.62);
      } else if (stroke.taper === 'chisel') {
        const bell = Math.sin(t * Math.PI);
        taperMult = 0.62 + 0.46 * Math.pow(bell, 0.5);
      } else if (stroke.taper === 'taper-end') {
        taperMult = 1.08 - t * 0.62;
      } else if (stroke.taper === 'taper-start') {
        taperMult = 0.46 + t * 0.62;
      } else {
        // Uniform oval with subtle calligraphic contrast
        taperMult = 0.88 + 0.22 * Math.abs(Math.sin(t * Math.PI * 2));
      }

      // Counter pinch thickens loop walls to squeeze interior space
      if (stroke.isCounter) {
        taperMult *= 1 + counterPinch * 0.34;
      }

      // Piece variation modulates organic ink pressure along stroke
      if (variation > 0) {
        const pressure =
          1 + hashSigned(unicode * 41 + sIdx * 17 + i * 5) * variation * 0.22;
        taperMult *= pressure;
      }

      const radius = Math.max(7, baseRadius * wScale * taperMult);
      return [x, y, radius];
    });

    for (let i = 0; i < worldPts.length - 1; i++) {
      const [ax, ay, ra] = worldPts[i];
      const [bx, by, rb] = worldPts[i + 1];
      const maxR = Math.max(ra, rb);
      segments.push({
        ax,
        ay,
        bx,
        by,
        ra,
        rb,
        isDiacritic: !!stroke.isDiacritic,
        isCounter: !!stroke.isCounter,
        minX: Math.min(ax, bx) - maxR,
        maxX: Math.max(ax, bx) + maxR,
        minY: Math.min(ay, by) - maxR,
        maxY: Math.max(ay, by) + maxR,
      });
    }

    // Authentic ALMA ballpoint double-stroke echo on main stems when pieceVariation is high
    if (
      variation > 0.32 &&
      !stroke.isDiacritic &&
      (pieceKey === 'stem-left' || pieceKey === 'stem-right' || pieceKey === 'diag-plunge') &&
      isPieceEnabled
    ) {
      const echoOffset = (variation - 0.32) * 26;
      const dir = sIdx % 2 === 0 ? 1 : -1;
      for (let i = 0; i < worldPts.length - 1; i++) {
        const [ax, ay, ra] = worldPts[i];
        const [bx, by, rb] = worldPts[i + 1];
        const eRa = ra * 0.58;
        const eRb = rb * 0.58;
        const ox1 = dir * echoOffset * Math.sin((i / worldPts.length) * Math.PI);
        const ox2 = dir * echoOffset * Math.sin(((i + 1) / worldPts.length) * Math.PI);
        const maxR = Math.max(eRa, eRb);
        segments.push({
          ax: ax + ox1,
          ay,
          bx: bx + ox2,
          by,
          ra: eRa,
          rb: eRb,
          isDiacritic: false,
          isCounter: !!stroke.isCounter,
          minX: Math.min(ax + ox1, bx + ox2) - maxR,
          maxX: Math.max(ax + ox1, bx + ox2) + maxR,
          minY: Math.min(ay, by) - maxR,
          maxY: Math.max(ay, by) + maxR,
        });
      }
    }
  });

  // Compute tight advance width from actual segment horizontal extent
  let maxExtentX = sidebearing + glyphW;
  for (const s of segments) {
    if (!s.isDiacritic && s.maxX > maxExtentX) {
      maxExtentX = s.maxX;
    }
  }
  const advanceWidth = Math.round(maxExtentX + sidebearing * 0.65);
  return { segments, advanceWidth };
}

// Signed polygon area in Y-up space: < 0 is CW, > 0 is CCW
export function polygonSignedArea(pts: [number, number][]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return area * 0.5;
}

function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Marching Squares lookup: returns pairs of edge indices [fromEdge, toEdge]
// Edge indices: 0=bottom(v00-v10), 1=right(v10-v11), 2=top(v11-v01), 3=left(v01-v00)
// Bits: bit0=v00<0, bit1=v10<0, bit2=v11<0, bit3=v01<0
function marchingCellSegments(
  code: number,
  centerVal: number
): [number, number][] {
  switch (code) {
    case 0:
    case 15:
      return [];
    case 1:
      return [[3, 0]];
    case 2:
      return [[0, 1]];
    case 3:
      return [[3, 1]];
    case 4:
      return [[1, 2]];
    case 5:
      return centerVal < 0
        ? [
            [3, 2],
            [1, 0],
          ]
        : [
            [3, 0],
            [1, 2],
          ];
    case 6:
      return [[0, 2]];
    case 7:
      return [[3, 2]];
    case 8:
      return [[2, 3]];
    case 9:
      return [[2, 0]];
    case 10:
      return centerVal < 0
        ? [
            [0, 3],
            [2, 1],
          ]
        : [
            [0, 1],
            [2, 3],
          ];
    case 11:
      return [[2, 1]];
    case 12:
      return [[1, 3]];
    case 13:
      return [[1, 0]];
    case 14:
      return [[0, 3]];
    default:
      return [];
  }
}

function extractContoursFromSDF(
  segments: Segment2D[],
  meltK: number
): [number, number][][] {
  if (segments.length === 0) return [];

  // Tight bounding box with margin for smooth-min & zero crossing
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of segments) {
    if (s.minX < minX) minX = s.minX;
    if (s.maxX > maxX) maxX = s.maxX;
    if (s.minY < minY) minY = s.minY;
    if (s.maxY > maxY) maxY = s.maxY;
  }

  const pad = Math.max(36, meltK * 0.75 + 24);
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // Adaptive crisp cell size (~11 units per cell for fast, sharp contours)
  const cellSize = Math.max(10, Math.min(14, Math.max(spanX, spanY) / 96));
  const cols = Math.max(24, Math.min(110, Math.ceil(spanX / cellSize)));
  const rows = Math.max(24, Math.min(125, Math.ceil(spanY / cellSize)));
  const dx = spanX / cols;
  const dy = spanY / rows;

  const baseSegs = segments.filter((s) => !s.isDiacritic);
  const diaSegs = segments.filter((s) => s.isDiacritic);

  const stride = cols + 1;
  const field = new Float32Array((cols + 1) * (rows + 1));

  for (let j = 0; j <= rows; j++) {
    const py = minY + j * dy;
    const rowOff = j * stride;
    for (let i = 0; i <= cols; i++) {
      const px = minX + i * dx;

      let dBase = 1e6;
      for (let k = 0; k < baseSegs.length; k++) {
        const s = baseSegs[k];
        // Fast AABB reject when distance cannot affect current smin
        const margin = dBase + meltK;
        if (
          px < s.minX - margin ||
          px > s.maxX + margin ||
          py < s.minY - margin ||
          py > s.maxY + margin
        ) {
          continue;
        }
        const d = sdTaperedCapsule(px, py, s.ax, s.ay, s.bx, s.by, s.ra, s.rb);
        dBase = dBase > 1e5 ? d : smin(dBase, d, meltK);
      }

      let dFinal = dBase;
      if (diaSegs.length > 0) {
        let dDia = 1e6;
        for (let k = 0; k < diaSegs.length; k++) {
          const s = diaSegs[k];
          const d = sdTaperedCapsule(px, py, s.ax, s.ay, s.bx, s.by, s.ra, s.rb);
          if (d < dDia) dDia = d;
        }
        if (dDia < dFinal) dFinal = dDia;
      }

      field[rowOff + i] = dFinal;
    }
  }

  // Build directed edge graph for Marching Squares contour stitching
  const edgeNext = new Map<string, string>();
  const edgePos = new Map<string, [number, number]>();

  const interpEdge = (
    i: number,
    j: number,
    edgeIdx: number,
    v00: number,
    v10: number,
    v11: number,
    v01: number
  ): string => {
    let key: string;
    let x: number;
    let y: number;
    if (edgeIdx === 0) {
      key = `H:${i},${j}`;
      const t = v00 / (v00 - v10 || 1e-9);
      x = minX + (i + Math.max(0.01, Math.min(0.99, t))) * dx;
      y = minY + j * dy;
    } else if (edgeIdx === 1) {
      key = `V:${i + 1},${j}`;
      const t = v10 / (v10 - v11 || 1e-9);
      x = minX + (i + 1) * dx;
      y = minY + (j + Math.max(0.01, Math.min(0.99, t))) * dy;
    } else if (edgeIdx === 2) {
      key = `H:${i},${j + 1}`;
      const t = v01 / (v01 - v11 || 1e-9);
      x = minX + (i + Math.max(0.01, Math.min(0.99, t))) * dx;
      y = minY + (j + 1) * dy;
    } else {
      key = `V:${i},${j}`;
      const t = v00 / (v00 - v01 || 1e-9);
      x = minX + i * dx;
      y = minY + (j + Math.max(0.01, Math.min(0.99, t))) * dy;
    }
    if (!edgePos.has(key)) {
      edgePos.set(key, [x, y]);
    }
    return key;
  };

  for (let j = 0; j < rows; j++) {
    const r0 = j * stride;
    const r1 = (j + 1) * stride;
    for (let i = 0; i < cols; i++) {
      const v00 = field[r0 + i];
      const v10 = field[r0 + i + 1];
      const v11 = field[r1 + i + 1];
      const v01 = field[r1 + i];

      const code =
        (v00 < 0 ? 1 : 0) |
        (v10 < 0 ? 2 : 0) |
        (v11 < 0 ? 4 : 0) |
        (v01 < 0 ? 8 : 0);

      if (code === 0 || code === 15) continue;

      const center = (v00 + v10 + v11 + v01) * 0.25;
      const segPairs = marchingCellSegments(code, center);
      for (const [eFrom, eTo] of segPairs) {
        const kFrom = interpEdge(i, j, eFrom, v00, v10, v11, v01);
        const kTo = interpEdge(i, j, eTo, v00, v10, v11, v01);
        edgeNext.set(kFrom, kTo);
      }
    }
  }

  // Trace closed loops
  const visited = new Set<string>();
  const loops: [number, number][][] = [];

  for (const startKey of edgeNext.keys()) {
    if (visited.has(startKey)) continue;
    const loop: [number, number][] = [];
    let cur: string | undefined = startKey;
    let safety = 0;
    while (cur && !visited.has(cur) && safety < 10000) {
      visited.add(cur);
      const pos = edgePos.get(cur);
      if (pos) loop.push(pos);
      cur = edgeNext.get(cur);
      safety++;
    }
    if (loop.length >= 6 && Math.abs(polygonSignedArea(loop)) > 220) {
      loops.push(loop);
    }
  }

  return loops;
}

// Corner-preserving Laplacian smoothing for cleaner contours without blunting sharp spikes
function smoothClosedLoop(pts: [number, number][], passes = 2): [number, number][] {
  let cur = pts;
  const n = cur.length;
  for (let p = 0; p < passes; p++) {
    const next: [number, number][] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = cur[(i - 1 + n) % n];
      const curr = cur[i];
      const nxt = cur[(i + 1) % n];
      const ax = prev[0] - curr[0];
      const ay = prev[1] - curr[1];
      const bx = nxt[0] - curr[0];
      const by = nxt[1] - curr[1];
      const la = Math.hypot(ax, ay) || 1;
      const lb = Math.hypot(bx, by) || 1;
      const dot = (ax * bx + ay * by) / (la * lb);
      // Preserve sharper tips (dot > -0.35 means sharper than ~110 deg interior angle)
      const weight = dot > -0.35 ? 0.08 : 0.42;
      const avgX = (prev[0] + nxt[0]) * 0.5;
      const avgY = (prev[1] + nxt[1]) * 0.5;
      next[i] = [
        curr[0] * (1 - weight) + avgX * weight,
        curr[1] * (1 - weight) + avgY * weight,
      ];
    }
    cur = next;
  }
  return cur;
}

// Ramer-Douglas-Peucker for closed polygon
function rdpOpen(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let maxDist = -1;
  let splitIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let dist: number;
    if (lenSq < 1e-8) {
      dist = Math.hypot(px - ax, py - ay);
    } else {
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    if (dist > maxDist) {
      maxDist = dist;
      splitIdx = i;
    }
  }

  if (maxDist > eps) {
    const left = rdpOpen(pts.slice(0, splitIdx + 1), eps);
    const right = rdpOpen(pts.slice(splitIdx), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

function simplifyClosedLoop(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 8) return pts;
  // Find two farthest points to split the closed loop cleanly
  let idxA = 0;
  let idxB = Math.floor(pts.length / 2);
  let bestD = -1;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + Math.floor(pts.length / 2)) % pts.length;
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    if (d > bestD) {
      bestD = d;
      idxA = i;
      idxB = j;
    }
  }

  const ordered: [number, number][] = [];
  for (let k = 0; k < pts.length; k++) {
    ordered.push(pts[(idxA + k) % pts.length]);
  }
  const splitPos = (idxB - idxA + pts.length) % pts.length;
  const part1 = rdpOpen(ordered.slice(0, splitPos + 1), eps);
  const part2 = rdpOpen([...ordered.slice(splitPos), ordered[0]], eps);
  const merged = [...part1.slice(0, -1), ...part2.slice(0, -1)];
  return merged.length >= 4 ? merged : pts;
}

// Convert simplified closed polygon into smooth + corner-preserving Cubic Bezier contour
function polygonToBezierContour(
  pts: [number, number][],
  isHole: boolean
): BezierContour {
  const n = pts.length;
  const bezierPts: BezierPoint[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const vInX = curr[0] - prev[0];
    const vInY = curr[1] - prev[1];
    const vOutX = next[0] - curr[0];
    const vOutY = next[1] - curr[1];
    const lenIn = Math.hypot(vInX, vInY) || 1;
    const lenOut = Math.hypot(vOutX, vOutY) || 1;

    // Cosine of turning angle (1 = straight, 0 = 90 deg turn, -1 = 180 deg U-turn)
    const cosTurn = (vInX * vOutX + vInY * vOutY) / (lenIn * lenOut);
    const isSharpCorner = cosTurn < 0.42; // sharper than ~65 deg turn

    if (isSharpCorner) {
      bezierPts.push({
        x: Math.round(curr[0] * 10) / 10,
        y: Math.round(curr[1] * 10) / 10,
        inX: Math.round((curr[0] - vInX * 0.16) * 10) / 10,
        inY: Math.round((curr[1] - vInY * 0.16) * 10) / 10,
        outX: Math.round((curr[0] + vOutX * 0.16) * 10) / 10,
        outY: Math.round((curr[1] + vOutY * 0.16) * 10) / 10,
        smooth: false,
      });
    } else {
      // Smooth Catmull-Rom tangent scaled safely to prevent loops
      let tx = next[0] - prev[0];
      let ty = next[1] - prev[1];
      const tLen = Math.hypot(tx, ty) || 1;
      tx /= tLen;
      ty /= tLen;

      const handleIn = Math.min(lenIn * 0.34, 48);
      const handleOut = Math.min(lenOut * 0.34, 48);

      bezierPts.push({
        x: Math.round(curr[0] * 10) / 10,
        y: Math.round(curr[1] * 10) / 10,
        inX: Math.round((curr[0] - tx * handleIn) * 10) / 10,
        inY: Math.round((curr[1] - ty * handleIn) * 10) / 10,
        outX: Math.round((curr[0] + tx * handleOut) * 10) / 10,
        outY: Math.round((curr[1] + ty * handleOut) * 10) / 10,
        smooth: true,
      });
    }
  }

  return { points: bezierPts, isHole };
}

// LRU Cache so dragging sliders is super snappy across large texts
const glyphCache = new Map<string, GlyphData>();
const MAX_CACHE_ENTRIES = 900;

export function paramsSignature(params: ConstructionParams): string {
  const pieces = Object.entries(params.activePieces)
    .map(([k, v]) => (v ? k[0] + k[k.length - 1] : ''))
    .join('');
  return [
    params.pieceVariation,
    params.exaggeration,
    params.jointMelt,
    params.counterPinch,
    params.limbDrop,
    params.baselineBounce,
    params.waistHeight,
    params.strokeWeight,
    pieces,
  ].join('|');
}

export function generateProceduralGlyph(
  char: string,
  params: ConstructionParams
): GlyphData {
  const key = `${char}::${paramsSignature(params)}`;
  const cached = glyphCache.get(key);
  if (cached) return cached;

  const { segments, advanceWidth } = buildSegmentsForGlyph(char, params);
  if (segments.length === 0) {
    const empty: GlyphData = {
      char,
      unicode: char.codePointAt(0) ?? 32,
      advanceWidth,
      contours: [],
      isManualOverride: false,
    };
    glyphCache.set(key, empty);
    return empty;
  }

  // Joint melt radius in em-square units (0 -> crisp sketch, 100 -> molten liquid joints)
  const meltK = (params.jointMelt / 100) * 86;
  const rawLoops = extractContoursFromSDF(segments, meltK);

  // Determine nesting depth (outer vs inner counter hole)
  const processedLoops = rawLoops.map((loop) =>
    simplifyClosedLoop(smoothClosedLoop(loop, 2), 6.2)
  );

  const contours: BezierContour[] = processedLoops.map((loop, idx) => {
    const testPt = loop[0];
    let depth = 0;
    for (let j = 0; j < processedLoops.length; j++) {
      if (j === idx) continue;
      if (pointInPolygon(testPt[0], testPt[1], processedLoops[j])) {
        depth++;
      }
    }
    const isHole = depth % 2 === 1;

    // Enforce TrueType winding in Y-up space:
    // Outer contour => CW (signedArea < 0)
    // Hole contour  => CCW (signedArea > 0)
    const area = polygonSignedArea(loop);
    let oriented = loop;
    if ((!isHole && area > 0) || (isHole && area < 0)) {
      oriented = [...loop].reverse();
    }

    return polygonToBezierContour(oriented, isHole);
  });

  const glyph: GlyphData = {
    char,
    unicode: char.codePointAt(0) ?? 65,
    advanceWidth,
    contours,
    isManualOverride: false,
  };

  if (glyphCache.size >= MAX_CACHE_ENTRIES) {
    glyphCache.clear();
  }
  glyphCache.set(key, glyph);
  return glyph;
}

/** Convert GlyphData contours into an SVG path string in SVG Y-down coords (y_svg = ASCENDER - y) */
export function glyphToSvgPath(contours: BezierContour[], ascender = ASCENDER): string {
  const parts: string[] = [];
  for (const contour of contours) {
    const pts = contour.points;
    if (pts.length < 2) continue;
    const p0 = pts[0];
    parts.push(`M ${p0.x.toFixed(1)} ${(ascender - p0.y).toFixed(1)}`);
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      parts.push(
        `C ${curr.outX.toFixed(1)} ${(ascender - curr.outY).toFixed(1)}, ${next.inX.toFixed(1)} ${(ascender - next.inY).toFixed(1)}, ${next.x.toFixed(1)} ${(ascender - next.y).toFixed(1)}`
      );
    }
    parts.push('Z');
  }
  return parts.join(' ');
}
