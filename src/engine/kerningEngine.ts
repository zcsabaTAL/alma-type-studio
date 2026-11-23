import { BezierContour, ConstructionParams, GlyphData } from '../types/font';
import { CAP_HEIGHT, generateProceduralGlyph } from './sdfVectorizer';

export interface KerningPairEntry {
  left: string;
  right: string;
  key: string; // e.g. "AV"
  autoValue: number;
  value: number;
  isManual: boolean;
}

interface HorizontalProfile {
  leftEdge: Float32Array;
  rightEdge: Float32Array;
  hasInk: boolean;
}

const BAND_COUNT = 28;
const BAND_MIN_Y = -40;
const BAND_MAX_Y = CAP_HEIGHT + 40;
const BAND_HEIGHT = (BAND_MAX_Y - BAND_MIN_Y) / BAND_COUNT;

// Curated high-impact kerning pairs covering English + Hungarian typography
export const CANDIDATE_KERNING_PAIRS: [string, string][] = [
  // Classic uppercase collisions & overhangs
  ['A', 'V'], ['A', 'W'], ['A', 'Y'], ['A', 'T'], ['A', 'O'], ['A', 'C'], ['A', 'G'], ['A', 'Q'], ['A', 'L'],
  ['Á', 'V'], ['Á', 'W'], ['Á', 'Y'], ['Á', 'T'], ['Á', 'O'], ['Á', 'C'], ['Á', 'L'],
  ['V', 'A'], ['V', 'Á'], ['V', 'O'], ['V', 'Ó'], ['V', 'Ö'], ['V', 'Ő'], ['V', 'a'], ['V', 'á'], ['V', 'e'], ['V', 'é'], ['V', 'o'], ['V', 'ó'], ['V', 'ö'], ['V', 'ő'], ['V', 'u'], ['V', 'r'],
  ['W', 'A'], ['W', 'Á'], ['W', 'O'], ['W', 'a'], ['W', 'á'], ['W', 'e'], ['W', 'é'], ['W', 'o'], ['W', 'ó'], ['W', 'ö'], ['W', 'ő'], ['W', 'r'],
  ['Y', 'A'], ['Y', 'Á'], ['Y', 'O'], ['Y', 'a'], ['Y', 'á'], ['Y', 'e'], ['Y', 'é'], ['Y', 'o'], ['Y', 'ó'], ['Y', 'ö'], ['Y', 'ő'], ['Y', 'u'], ['Y', 'ü'],
  ['T', 'A'], ['T', 'Á'], ['T', 'O'], ['T', 'Ó'], ['T', 'Ö'], ['T', 'Ő'], ['T', 'a'], ['T', 'á'], ['T', 'e'], ['T', 'é'], ['T', 'o'], ['T', 'ó'], ['T', 'ö'], ['T', 'ő'], ['T', 'r'], ['T', 'u'], ['T', 'ú'], ['T', 'ü'], ['T', 'ű'], ['T', 'y'], ['T', 'v'], ['T', 'w'],
  ['L', 'T'], ['L', 'V'], ['L', 'W'], ['L', 'Y'], ['L', 'A'], ['L', 'Á'], ['L', 'O'], ['L', 'Ó'], ['L', 'Ö'], ['L', 'Ő'], ['L', 'M'], ['L', 'y'], ['L', 'v'],
  ['F', 'A'], ['F', 'Á'], ['F', 'a'], ['F', 'á'], ['F', 'e'], ['F', 'é'], ['F', 'o'], ['F', 'ó'], ['F', 'ö'], ['F', 'ő'], ['F', 'r'],
  ['P', 'A'], ['P', 'Á'], ['P', 'a'], ['P', 'á'], ['P', 'e'], ['P', 'é'], ['P', 'o'], ['P', 'ó'], ['P', 'ö'], ['P', 'ő'],
  ['K', 'O'], ['K', 'Ó'], ['K', 'Ö'], ['K', 'Ő'], ['K', 'a'], ['K', 'á'], ['K', 'e'], ['K', 'é'], ['K', 'o'], ['K', 'ó'], ['K', 'ö'], ['K', 'ő'], ['K', 'u'], ['K', 'y'],
  ['R', 'A'], ['R', 'Á'], ['R', 'V'], ['R', 'Y'], ['R', 'T'], ['R', 'O'], ['R', 'a'], ['R', 'e'], ['R', 'o'],
  ['M', 'A'], ['M', 'Á'], ['A', 'M'], ['Á', 'M'],
  ['D', 'A'], ['D', 'Á'], ['D', 'V'], ['D', 'Y'], ['O', 'A'], ['O', 'Á'], ['O', 'V'], ['O', 'Y'], ['O', 'T'],
  // Lowercase & Hungarian frequent pairs
  ['r', 'a'], ['r', 'á'], ['r', 'e'], ['r', 'é'], ['r', 'o'], ['r', 'ó'], ['r', 'ö'], ['r', 'ő'], ['r', 'c'], ['r', 'd'], ['r', 'g'], ['r', 'v'],
  ['f', 'a'], ['f', 'á'], ['f', 'e'], ['f', 'é'], ['f', 'o'], ['f', 'ó'], ['f', 'ö'], ['f', 'ő'], ['f', 'u'], ['f', 'ú'],
  ['v', 'a'], ['v', 'á'], ['v', 'e'], ['v', 'é'], ['v', 'o'], ['v', 'ó'], ['v', 'ö'], ['v', 'ő'],
  ['w', 'a'], ['w', 'á'], ['w', 'e'], ['w', 'é'], ['w', 'o'], ['w', 'ó'],
  ['y', 'a'], ['y', 'á'], ['y', 'e'], ['y', 'é'], ['y', 'o'], ['y', 'ó'],
  ['k', 'a'], ['k', 'á'], ['k', 'e'], ['k', 'é'], ['k', 'o'], ['k', 'ó'], ['k', 'ö'], ['k', 'ő'],
  ['t', 'a'], ['t', 'á'], ['t', 'e'], ['t', 'é'], ['t', 'o'], ['t', 'ó'], ['t', 'ö'], ['t', 'ő'],
  ['g', 'e'], ['g', 'é'], ['g', 'a'], ['g', 'á'], ['g', 'o'], ['g', 'ó'],
  ['a', 'v'], ['a', 'y'], ['a', 'w'], ['a', 't'], ['e', 'v'], ['e', 'y'], ['o', 'v'], ['o', 'y'],
  // Punctuation & digits
  ['A', '.'], ['A', ','], ['V', '.'], ['V', ','], ['W', '.'], ['W', ','], ['Y', '.'], ['Y', ','], ['T', '.'], ['T', ','], ['F', '.'], ['F', ','], ['P', '.'], ['P', ','],
  ['r', '.'], ['r', ','], ['v', '.'], ['v', ','], ['y', '.'], ['y', ','],
  ['7', '4'], ['4', '7'], ['1', '7'], ['7', '0'], ['7', '6'], ['7', '9'], ['2', '0'], ['2', '6'],
];

function sampleGlyphProfile(contours: BezierContour[]): HorizontalProfile {
  const leftEdge = new Float32Array(BAND_COUNT).fill(Infinity);
  const rightEdge = new Float32Array(BAND_COUNT).fill(-Infinity);
  let hasInk = false;

  const SAMPLES = 10;
  for (const contour of contours) {
    const pts = contour.points;
    const n = pts.length;
    if (n < 2) continue;

    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];

      for (let s = 0; s <= SAMPLES; s++) {
        const t = s / SAMPLES;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        const x =
          mt2 * mt * p0.x +
          3 * mt2 * t * p0.outX +
          3 * mt * t2 * p1.inX +
          t2 * t * p1.x;
        const y =
          mt2 * mt * p0.y +
          3 * mt2 * t * p0.outY +
          3 * mt * t2 * p1.inY +
          t2 * t * p1.y;

        if (y < BAND_MIN_Y || y > BAND_MAX_Y) continue;
        const band = Math.min(
          BAND_COUNT - 1,
          Math.max(0, Math.floor((y - BAND_MIN_Y) / BAND_HEIGHT))
        );
        if (x < leftEdge[band]) leftEdge[band] = x;
        if (x > rightEdge[band]) rightEdge[band] = x;
        hasInk = true;
      }
    }
  }

  return { leftEdge, rightEdge, hasInk };
}

/**
 * Measures the minimum optical horizontal clearance across 28 vertical bands
 * when rightGlyph is placed at leftGlyph.advanceWidth.
 */
function measureMinOpticalGap(
  leftGlyph: GlyphData,
  leftProf: HorizontalProfile,
  rightProf: HorizontalProfile
): number | null {
  if (!leftProf.hasInk || !rightProf.hasInk) return null;

  let minGap = Infinity;
  let overlapBands = 0;

  for (let b = 0; b < BAND_COUNT; b++) {
    const rEdge = leftProf.rightEdge[b];
    if (rEdge === -Infinity) continue;

    // Check same band and immediate vertical neighbors so diagonal strokes don't collide
    for (let db = -1; db <= 1; db++) {
      const nb = b + db;
      if (nb < 0 || nb >= BAND_COUNT) continue;
      const lEdge = rightProf.leftEdge[nb];
      if (lEdge === Infinity) continue;

      const gap = leftGlyph.advanceWidth + lEdge - rEdge;
      const adjustedGap = db === 0 ? gap : gap + 14;
      if (adjustedGap < minGap) {
        minGap = adjustedGap;
      }
      overlapBands++;
    }
  }

  return overlapBands > 0 && Number.isFinite(minGap) ? minGap : null;
}

function computePairOpticalKern(
  leftGlyph: GlyphData,
  leftProf: HorizontalProfile,
  rightProf: HorizontalProfile,
  targetGap: number,
  strength: number
): number {
  if (strength <= 0) return 0;
  const minGap = measureMinOpticalGap(leftGlyph, leftProf, rightProf);
  if (minGap === null) return 0;

  // Only kern when the optical gap noticeably exceeds (or pinches below) the neutral H+H reference gap
  const rawDelta = (targetGap - minGap) * strength;
  const clamped = Math.max(-155, Math.min(45, rawDelta));
  const snapped = Math.round(clamped / 5) * 5;
  return Math.abs(snapped) >= 10 ? snapped : 0;
}

export function computeOpticalKerning(
  params: ConstructionParams,
  overrides: Record<string, GlyphData>,
  kerningStrength: number, // 0..140 (%)
  manualKerning: Record<string, number>
): {
  kerningMap: Record<string, number>;
  entries: KerningPairEntry[];
} {
  const strength = Math.max(0, kerningStrength) / 100;

  const glyphCacheLocal = new Map<string, GlyphData>();
  const profileCache = new Map<string, HorizontalProfile>();

  const getGlyphAndProfile = (ch: string) => {
    let g = glyphCacheLocal.get(ch);
    if (!g) {
      g = overrides[ch] ?? generateProceduralGlyph(ch, params);
      glyphCacheLocal.set(ch, g);
    }
    let p = profileCache.get(ch);
    if (!p) {
      p = sampleGlyphProfile(g.contours);
      profileCache.set(ch, p);
    }
    return { glyph: g, profile: p };
  };

  // Calibrate target optical clearance dynamically from neutral vertical pair "HH"
  // so italic forward slant and weight changes never over-kern normal letter spacing!
  const hh = getGlyphAndProfile('H');
  const measuredRefGap = measureMinOpticalGap(hh.glyph, hh.profile, hh.profile);
  const targetGap = measuredRefGap !== null ? measuredRefGap * 0.94 : 110;

  const kerningMap: Record<string, number> = {};
  const entries: KerningPairEntry[] = [];
  const seenKeys = new Set<string>();

  for (const [left, right] of CANDIDATE_KERNING_PAIRS) {
    const key = `${left}${right}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const { glyph: lg, profile: lp } = getGlyphAndProfile(left);
    const { profile: rp } = getGlyphAndProfile(right);
    const autoValue = computePairOpticalKern(lg, lp, rp, targetGap, strength);
    const isManual = key in manualKerning;
    const value = isManual ? manualKerning[key] : autoValue;

    if (value !== 0) {
      kerningMap[key] = value;
    }
    entries.push({ left, right, key, autoValue, value, isManual });
  }

  // Include any custom user-added pairs not in the default list
  for (const [key, val] of Object.entries(manualKerning)) {
    if (seenKeys.has(key)) continue;
    const chars = [...key];
    if (chars.length !== 2) continue;
    const [left, right] = chars;
    const { glyph: lg, profile: lp } = getGlyphAndProfile(left);
    const { profile: rp } = getGlyphAndProfile(right);
    const autoValue = computePairOpticalKern(lg, lp, rp, targetGap, strength);
    if (val !== 0) {
      kerningMap[key] = val;
    }
    entries.push({ left, right, key, autoValue, value: val, isManual: true });
  }

  // Sort by strongest visual adjustment first
  entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return { kerningMap, entries };
}
