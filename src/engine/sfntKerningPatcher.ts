/**
 * Injects spec-compliant OpenType `GPOS` (LookupType 2 PairPos Format 1 under DFLT/latn `kern`)
 * AND legacy TrueType `kern` (Version 0, Format 0) tables into an SFNT font ArrayBuffer
 * produced by opentype.js, and recalculates all table checksums + `head.checkSumAdjustment`.
 */

export interface GlyphKernPair {
  leftGlyphId: number;
  rightGlyphId: number;
  value: number; // signed 16-bit FWord adjustment
}

class BinaryWriter {
  private buf: number[] = [];

  get length(): number {
    return this.buf.length;
  }

  u8(v: number) {
    this.buf.push(v & 0xff);
  }

  u16(v: number) {
    this.buf.push((v >>> 8) & 0xff, v & 0xff);
  }

  i16(v: number) {
    const val = v < 0 ? 0x10000 + v : v;
    this.u16(val);
  }

  u32(v: number) {
    this.buf.push(
      (v >>> 24) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 8) & 0xff,
      v & 0xff
    );
  }

  tag(str: string) {
    for (let i = 0; i < 4; i++) {
      this.u8(str.charCodeAt(i) || 0x20);
    }
  }

  bytes(arr: Uint8Array) {
    for (let i = 0; i < arr.length; i++) {
      this.buf.push(arr[i]);
    }
  }

  patchU16(offset: number, v: number) {
    this.buf[offset] = (v >>> 8) & 0xff;
    this.buf[offset + 1] = v & 0xff;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

function calcTableChecksum(bytes: Uint8Array): number {
  let sum = 0;
  const len = bytes.length;
  for (let i = 0; i < len; i += 4) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const b3 = bytes[i + 3] ?? 0;
    const word = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

function binarySearchParams(count: number, unitSize: number) {
  let entrySelector = 0;
  let power = 1;
  while (power * 2 <= count) {
    power *= 2;
    entrySelector++;
  }
  const searchRange = power * unitSize;
  const rangeShift = Math.max(0, count * unitSize - searchRange);
  return { searchRange, entrySelector, rangeShift };
}

function buildKernTable(pairs: GlyphKernPair[]): Uint8Array {
  // Sort lexicographically by (left << 16) | right as required by Format 0 binary search
  const sorted = [...pairs].sort(
    (a, b) => a.leftGlyphId - b.leftGlyphId || a.rightGlyphId - b.rightGlyphId
  );

  const w = new BinaryWriter();
  // Header: version=0, nTables=1
  w.u16(0);
  w.u16(1);

  const nPairs = sorted.length;
  const subtableLength = 14 + nPairs * 6;
  const { searchRange, entrySelector, rangeShift } = binarySearchParams(nPairs, 6);

  // Subtable header (Format 0, horizontal coverage = 0x0001)
  w.u16(0); // version
  w.u16(subtableLength);
  w.u16(0x0001); // coverage: horizontal kerning
  w.u16(nPairs);
  w.u16(searchRange);
  w.u16(entrySelector);
  w.u16(rangeShift);

  for (const p of sorted) {
    w.u16(p.leftGlyphId);
    w.u16(p.rightGlyphId);
    w.i16(Math.round(p.value));
  }

  return w.toUint8Array();
}

function buildGposTable(pairs: GlyphKernPair[]): Uint8Array {
  // Group pairs by leftGlyphId -> sorted list of { rightGlyphId, value }
  const grouped = new Map<number, { right: number; value: number }[]>();
  for (const p of pairs) {
    let list = grouped.get(p.leftGlyphId);
    if (!list) {
      list = [];
      grouped.set(p.leftGlyphId, list);
    }
    list.push({ right: p.rightGlyphId, value: Math.round(p.value) });
  }

  const firstGlyphIds = Array.from(grouped.keys()).sort((a, b) => a - b);
  for (const gid of firstGlyphIds) {
    grouped.get(gid)!.sort((a, b) => a.right - b.right);
  }

  // 1) Build ScriptList (DFLT + latn pointing to LangSys with featureIndex 0)
  const scriptList = new BinaryWriter();
  // ScriptCount = 2
  scriptList.u16(2);
  // ScriptRecord 0: 'DFLT' -> offset 14 (2 + 2*6)
  scriptList.tag('DFLT');
  scriptList.u16(14);
  // ScriptRecord 1: 'latn' -> offset 14 (shared Script table)
  scriptList.tag('latn');
  scriptList.u16(14);
  // Script table at offset 14: defaultLangSysOffset = 4, langSysCount = 0
  scriptList.u16(4);
  scriptList.u16(0);
  // LangSys table at offset 18: lookupOrder=0, reqFeatureIndex=0xFFFF, featureIndexCount=1, featureIndex[0]=0
  scriptList.u16(0);
  scriptList.u16(0xffff);
  scriptList.u16(1);
  scriptList.u16(0);
  const scriptListBytes = scriptList.toUint8Array();

  // 2) Build FeatureList ('kern' -> lookupIndex 0)
  const featureList = new BinaryWriter();
  featureList.u16(1); // featureCount
  featureList.tag('kern');
  featureList.u16(8); // offset from featureList start (2 + 6)
  // Feature table at offset 8: featureParams=0, lookupIndexCount=1, lookupListIndices=[0]
  featureList.u16(0);
  featureList.u16(1);
  featureList.u16(0);
  const featureListBytes = featureList.toUint8Array();

  // 3) Build PairPos Format 1 subtable
  // Header: posFormat(2) + coverageOffset(2) + valueFormat1(2) + valueFormat2(2) + pairSetCount(2) + pairSetOffsets(2*N)
  const pairPos = new BinaryWriter();
  pairPos.u16(1); // posFormat = 1 (Adjustments for Glyph Pairs)
  const coverageOffsetPos = pairPos.length;
  pairPos.u16(0); // placeholder for coverageOffset
  pairPos.u16(0x0004); // valueFormat1 = XAdvance
  pairPos.u16(0x0000); // valueFormat2 = none
  pairPos.u16(firstGlyphIds.length); // pairSetCount

  const pairSetOffsetPositions: number[] = [];
  for (let i = 0; i < firstGlyphIds.length; i++) {
    pairSetOffsetPositions.push(pairPos.length);
    pairPos.u16(0); // placeholder
  }

  // Coverage Format 1 immediately after header
  pairPos.patchU16(coverageOffsetPos, pairPos.length);
  pairPos.u16(1); // coverageFormat = 1
  pairPos.u16(firstGlyphIds.length);
  for (const gid of firstGlyphIds) {
    pairPos.u16(gid);
  }

  // PairSet tables
  for (let i = 0; i < firstGlyphIds.length; i++) {
    const gid = firstGlyphIds[i];
    const items = grouped.get(gid)!;
    pairPos.patchU16(pairSetOffsetPositions[i], pairPos.length);
    pairPos.u16(items.length); // pairValueCount
    for (const item of items) {
      pairPos.u16(item.right); // secondGlyph
      pairPos.i16(item.value); // value1.xAdvance
    }
  }
  const pairPosBytes = pairPos.toUint8Array();

  // 4) Build LookupList (1 Lookup of type 2 PairPos with 1 subtable)
  const lookupList = new BinaryWriter();
  lookupList.u16(1); // lookupCount
  lookupList.u16(4); // lookupOffsets[0] = 4
  // Lookup table at offset 4:
  lookupList.u16(2); // lookupType = 2 (Pair adjustment)
  lookupList.u16(0); // lookupFlag = 0
  lookupList.u16(1); // subTableCount = 1
  lookupList.u16(8); // subtableOffsets[0] = 8 (relative to Lookup table start)
  lookupList.bytes(pairPosBytes);
  const lookupListBytes = lookupList.toUint8Array();

  // 5) Assemble GPOS Header (Version 1.0)
  const gpos = new BinaryWriter();
  const scriptListOffset = 10;
  const featureListOffset = scriptListOffset + scriptListBytes.length;
  const lookupListOffset = featureListOffset + featureListBytes.length;

  gpos.u16(1); // majorVersion
  gpos.u16(0); // minorVersion
  gpos.u16(scriptListOffset);
  gpos.u16(featureListOffset);
  gpos.u16(lookupListOffset);
  gpos.bytes(scriptListBytes);
  gpos.bytes(featureListBytes);
  gpos.bytes(lookupListBytes);

  return gpos.toUint8Array();
}

export function injectKerningTables(
  sourceBuffer: ArrayBuffer,
  pairs: GlyphKernPair[]
): ArrayBuffer {
  const validPairs = pairs.filter(
    (p) => p.value !== 0 && p.leftGlyphId > 0 && p.rightGlyphId > 0
  );
  if (validPairs.length === 0) return sourceBuffer;

  const srcBytes = new Uint8Array(sourceBuffer);
  const view = new DataView(sourceBuffer);

  const sfntVersion = view.getUint32(0, false);
  const numTables = view.getUint16(4, false);

  const tableMap = new Map<string, Uint8Array>();

  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = String.fromCharCode(
      srcBytes[recOff],
      srcBytes[recOff + 1],
      srcBytes[recOff + 2],
      srcBytes[recOff + 3]
    );
    const offset = view.getUint32(recOff + 8, false);
    const length = view.getUint32(recOff + 12, false);
    tableMap.set(tag, srcBytes.slice(offset, offset + length));
  }

  // Zero out head.checkSumAdjustment before recomputing checksums
  const headData = tableMap.get('head');
  if (headData && headData.length >= 12) {
    headData[8] = 0;
    headData[9] = 0;
    headData[10] = 0;
    headData[11] = 0;
  }

  // Add both GPOS (modern OpenType/HarfBuzz/CoreText) and kern (legacy Format 0)
  tableMap.set('GPOS', buildGposTable(validPairs));
  tableMap.set('kern', buildKernTable(validPairs));

  // Sort tables alphabetically by 4-byte ASCII tag (SFNT spec requirement)
  const sortedTags = Array.from(tableMap.keys()).sort();
  const outCount = sortedTags.length;
  const { searchRange, entrySelector, rangeShift } = binarySearchParams(outCount, 16);

  const headerSize = 12 + outCount * 16;
  let currentOffset = headerSize;

  const records: {
    tag: string;
    checksum: number;
    offset: number;
    length: number;
    data: Uint8Array;
  }[] = [];

  for (const tag of sortedTags) {
    const data = tableMap.get(tag)!;
    const checksum = calcTableChecksum(data);
    records.push({
      tag,
      checksum,
      offset: currentOffset,
      length: data.length,
      data,
    });
    currentOffset += (data.length + 3) & ~3;
  }

  const outBuf = new ArrayBuffer(currentOffset);
  const outBytes = new Uint8Array(outBuf);
  const outView = new DataView(outBuf);

  // Write SFNT Offset Table
  outView.setUint32(0, sfntVersion, false);
  outView.setUint16(4, outCount, false);
  outView.setUint16(6, searchRange, false);
  outView.setUint16(8, entrySelector, false);
  outView.setUint16(10, rangeShift, false);

  let headOffsetInOut = -1;
  records.forEach((rec, i) => {
    const recOff = 12 + i * 16;
    outBytes[recOff] = rec.tag.charCodeAt(0);
    outBytes[recOff + 1] = rec.tag.charCodeAt(1);
    outBytes[recOff + 2] = rec.tag.charCodeAt(2);
    outBytes[recOff + 3] = rec.tag.charCodeAt(3);
    outView.setUint32(recOff + 4, rec.checksum, false);
    outView.setUint32(recOff + 8, rec.offset, false);
    outView.setUint32(recOff + 12, rec.length, false);
    outBytes.set(rec.data, rec.offset);
    if (rec.tag === 'head') {
      headOffsetInOut = rec.offset;
    }
  });

  // Compute whole-font checksum and patch head.checkSumAdjustment
  if (headOffsetInOut >= 0) {
    const totalChecksum = calcTableChecksum(outBytes);
    const adjustment = (0xb1b0afba - totalChecksum) >>> 0;
    outView.setUint32(headOffsetInOut + 8, adjustment, false);
  }

  return outBuf;
}
