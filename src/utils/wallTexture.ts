import * as THREE from "three";

/**
 * Bakes a whole museum wall — light gradient, skirting, dado, frieze band and
 * pilaster rhythm — into ONE canvas texture per wall segment.
 *
 * Why a texture and not geometry: the walls used to be flat `#F2E9D8` boxes lit
 * only by ambient + hemisphere + a near-vertical key, i.e. the same value from
 * floor to ceiling with nothing dividing the surface. That reads as a painted
 * warehouse no matter how many props stand in front of it. The fix that costs
 * the least is the wall-wash gradient plus a horizontal division, and both are
 * pure pixels — no extra mesh, no extra light, no extra draw call (the wall
 * meshes already carried one material instance each), and it survives the
 * Rendah graphics preset where dynamic lights and shadows are switched off.
 *
 * Everything is authored in metres and in ASCENDING world coordinate along the
 * wall; `mirror` flips it at paint time for the two wall faces whose BoxGeometry
 * UVs run the other way (see RoomShell for which face is which).
 */

export type WallStyleId = "welcome" | "prasejarah" | "hindu-buddha" | "transisi-iptek" | "netral";

/** A stretch of wall, in metres from the segment's start, carrying one zone's identity. */
export interface WallBand {
  from: number;
  to: number;
  style: WallStyleId;
}

/** A stretch of wall that must stay dark and undecorated — hero/signature backdrops. */
export interface WallSpan {
  from: number;
  to: number;
}

interface WallStyle {
  /** Bidang utama, di atas dado. */
  upper: string;
  /** Bidang bawah (wainscot). */
  dado: string;
  /** Lis lantai. */
  skirting: string;
  /** Garis tipis pemisah dado. */
  capLine: string;
  /** Tinta motif pada pita frieze. */
  friezeInk: string;
  friezeMotif: "kawung" | "parang" | "artDeco" | "purba" | "polos";
  /** Kekuatan serat/bintik batu, 0..1 — hanya zona prasejarah yang memakainya. */
  grain: number;
}

/**
 * Per-zone wall identity. Prasejarah is deliberately the darkest and roughest
 * (batu/gua, and NO batik — batik is not a prehistoric context); Transisi/IPTEK
 * is the cleanest and coolest; Hindu-Buddha and Welcome sit between them on the
 * warm ivory the rest of the museum uses.
 */
const STYLES: Record<WallStyleId, WallStyle> = {
  welcome: {
    upper: "#F2E9D8",
    dado: "#E4D5B7",
    skirting: "#7A5230",
    capLine: "#B08D3C",
    friezeInk: "#B08D3C",
    friezeMotif: "kawung",
    grain: 0,
  },
  prasejarah: {
    upper: "#DACAAE",
    dado: "#C1AC8B",
    skirting: "#6B4527",
    capLine: "#8A6A3A",
    friezeInk: "#C56A3A",
    friezeMotif: "purba",
    grain: 0.6,
  },
  "hindu-buddha": {
    upper: "#EFE4CD",
    dado: "#DFCFAE",
    skirting: "#7A5230",
    capLine: "#B08D3C",
    friezeInk: "#2E4A7D",
    friezeMotif: "kawung",
    grain: 0.08,
  },
  "transisi-iptek": {
    upper: "#F5EFE1",
    dado: "#E7DECB",
    skirting: "#6E5A44",
    capLine: "#1F7A6E",
    friezeInk: "#1F7A6E",
    friezeMotif: "artDeco",
    grain: 0,
  },
  netral: {
    upper: "#F2E9D8",
    dado: "#E4D5B7",
    skirting: "#7A5230",
    capLine: "#B08D3C",
    friezeInk: "#B08D3C",
    friezeMotif: "polos",
    grain: 0,
  },
};

/** Layer heights, metres. Starting points from the brief, kept well under the
 * 5.5-6 m right-sized ceilings so the frieze never collides with the beam grid. */
export const SKIRTING_H = 0.12;
export const DADO_H = 1.0;
export const FRIEZE_H = 0.26;
/** Gap between the frieze band and the ceiling. */
export const FRIEZE_GAP = 0.35;
/** Nominal spacing of the vertical rhythm; actual spacing is evened out per bay. */
const PILASTER_SPACING = 3.5;
/** A free stretch shorter than this gets no line at all — a pilaster crammed
 * into a 1 m corner strip reads as a mistake, not as rhythm. */
const MIN_BAY = 1.8;

/** Horizontal/vertical canvas resolution. Vertical is deliberately ~3x denser:
 * every layer in this system is a horizontal band, so that is where the pixels
 * are worth spending. Both axes are capped so no texture exceeds 1024 px. */
const PX_PER_M_X = 24;
const PX_PER_M_Y = 80;
const MAX_PX = 1024;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where the vertical rhythm lands along a wall of this length, in metres from
 * its start.
 *
 * `blocked` is whatever already occupies this wall — hero backdrops, boards,
 * signage. The rhythm is laid out INSIDE each remaining free stretch rather
 * than on one grid across the whole wall: a fixed grid put lines through the
 * middle of every mounted board, and dropping those lines then left long walls
 * with no rhythm at all. Each free stretch gets its own evenly spaced bays, so
 * a wall reads as articulated right up to whatever is hanging on it.
 *
 * Exported so the optional pilaster geometry lands exactly on the painted lines.
 */
export function pilasterOffsets(lengthM: number, blocked: WallSpan[] = []): number[] {
  const cuts = blocked
    .map((s) => ({ from: Math.max(0, s.from), to: Math.min(lengthM, s.to) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);

  const free: WallSpan[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.from > cursor) free.push({ from: cursor, to: cut.from });
    cursor = Math.max(cursor, cut.to);
  }
  if (cursor < lengthM) free.push({ from: cursor, to: lengthM });

  const out: number[] = [];
  for (const span of free) {
    const len = span.to - span.from;
    if (len < MIN_BAY) continue;
    const bays = Math.max(1, Math.round(len / PILASTER_SPACING));
    for (let i = 0; i < bays; i++) out.push(span.from + (len * (i + 0.5)) / bays);
  }
  return out;
}

/** Deterministic noise — the stone grain must be identical every reload. */
function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function inAnySpan(spans: WallSpan[], at: number): boolean {
  return spans.some((s) => at >= s.from && at <= s.to);
}

export interface WallTextureOptions {
  /** Length of THIS wall segment (an archway splits a wall into two). */
  lengthM: number;
  heightM: number;
  bands: WallBand[];
  /** Hero/signature backdrops: kept dark and free of motif so the piece wins. */
  quiet?: WallSpan[];
  /** Stretches already carrying something mounted on the wall (interpretive
   * panel, relief, signage band). Not darkened — just skipped by the vertical
   * rhythm, so no painted pilaster runs up through the middle of a board. */
  occupied?: WallSpan[];
  /** True for the two faces whose BoxGeometry UVs run against world coordinate. */
  mirror?: boolean;
}

export function createWallTexture({
  lengthM,
  heightM,
  bands,
  quiet = [],
  occupied = [],
  mirror = false,
}: WallTextureOptions): THREE.CanvasTexture {
  const w = clamp(Math.round(lengthM * PX_PER_M_X), 64, MAX_PX);
  const h = clamp(Math.round(heightM * PX_PER_M_Y), 64, MAX_PX);
  const sx = w / lengthM;
  const sy = h / heightM;
  /** Canvas y for a height above the floor — canvas row 0 is the ceiling line. */
  const yAt = (mAboveFloor: number) => h - mAboveFloor * sy;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return empty;
  }

  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  const safeBands: WallBand[] = bands.length ? bands : [{ from: 0, to: lengthM, style: "netral" }];
  const styleAt = (m: number) => STYLES[safeBands.find((b) => m >= b.from && m <= b.to)?.style ?? "netral"];

  // --- 1. Base field + dado, per zone, with a soft blend at every zone seam so
  //        the wall reads as one continuous surface that shifts, not as tiles. ---
  const BLEND = 1.1; // metres either side of a seam
  const paintRow = (top: number, bottom: number, pick: (s: WallStyle) => string) => {
    for (const band of safeBands) {
      ctx.fillStyle = pick(STYLES[band.style]);
      ctx.fillRect(band.from * sx, top, (band.to - band.from) * sx + 1, bottom - top);
    }
    for (let i = 0; i < safeBands.length - 1; i++) {
      const seam = safeBands[i].to;
      const a = pick(STYLES[safeBands[i].style]);
      const b = pick(STYLES[safeBands[i + 1].style]);
      if (a === b) continue;
      const g = ctx.createLinearGradient((seam - BLEND) * sx, 0, (seam + BLEND) * sx, 0);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.fillStyle = g;
      ctx.fillRect((seam - BLEND) * sx, top, BLEND * 2 * sx, bottom - top);
    }
  };

  paintRow(0, h, (s) => s.upper);
  paintRow(yAt(DADO_H), h, (s) => s.dado);

  // --- 2. Stone grain (prasejarah only) — a rough, cave-like surface rather
  //        than the flat gallery plaster every other zone gets. ---
  const rand = seededRandom(Math.round(lengthM * 977 + heightM * 131));
  for (const band of safeBands) {
    const style = STYLES[band.style];
    if (style.grain <= 0) continue;
    const spots = Math.round((band.to - band.from) * heightM * 26 * style.grain);
    ctx.save();
    ctx.beginPath();
    ctx.rect(band.from * sx, 0, (band.to - band.from) * sx, h);
    ctx.clip();
    for (let i = 0; i < spots; i++) {
      const px = (band.from + rand() * (band.to - band.from)) * sx;
      const py = rand() * h;
      const r = (0.4 + rand() * 1.6) * (sx / 24) * 3;
      ctx.fillStyle = rand() > 0.5 ? "rgba(90,70,50,0.10)" : "rgba(255,246,228,0.10)";
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- 3. Vertical rhythm. A dark edge plus a lit edge, which is what a real
  //        shallow pilaster looks like: one side catches the wash, the other
  //        casts. Skipped inside a hero backdrop's quiet span. ---
  const pilasterTop = yAt(heightM - FRIEZE_GAP - FRIEZE_H);
  const pilasterBottom = yAt(SKIRTING_H);
  for (const at of pilasterOffsets(lengthM, [...quiet, ...occupied])) {
    const wide = 0.16 * sx;
    ctx.fillStyle = "rgba(84, 66, 44, 0.16)";
    ctx.fillRect(at * sx - wide, pilasterTop, wide, pilasterBottom - pilasterTop);
    ctx.fillStyle = "rgba(255, 249, 234, 0.30)";
    ctx.fillRect(at * sx, pilasterTop, wide * 0.7, pilasterBottom - pilasterTop);
  }

  // --- 4. Frieze: a BAND of motif near the ceiling, never the whole wall.
  //        The artefact always has to win; a full-wall motif fights it. ---
  const friezeTop = yAt(heightM - FRIEZE_GAP);
  const friezeBottom = friezeTop + FRIEZE_H * sy;
  for (const band of safeBands) {
    const style = STYLES[band.style];
    if (style.friezeMotif === "polos") continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(band.from * sx, friezeTop, (band.to - band.from) * sx, friezeBottom - friezeTop);
    ctx.clip();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = style.friezeInk;
    ctx.fillStyle = style.friezeInk;
    drawFrieze(ctx, style.friezeMotif, band.from * sx, friezeTop, (band.to - band.from) * sx, FRIEZE_H * sy, sx, quiet, sx);
    ctx.restore();
  }
  // Hairlines top and bottom of the frieze so the band has an edge even where
  // the motif is faint.
  for (const band of safeBands) {
    const style = STYLES[band.style];
    ctx.fillStyle = style.capLine;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(band.from * sx, friezeTop, (band.to - band.from) * sx, Math.max(1, 0.02 * sy));
    ctx.fillRect(band.from * sx, friezeBottom, (band.to - band.from) * sx, Math.max(1, 0.02 * sy));
    ctx.globalAlpha = 1;
  }

  // --- 5. Dado cap line + skirting. The skirting is the cheapest element here
  //        and does the most: without it the wall appears to float off the floor. ---
  const capY = yAt(DADO_H);
  for (const band of safeBands) {
    ctx.fillStyle = STYLES[band.style].capLine;
    ctx.fillRect(band.from * sx, capY - Math.max(1, 0.015 * sy), (band.to - band.from) * sx + 1, Math.max(2, 0.03 * sy));
  }
  paintRow(yAt(SKIRTING_H), h, (s) => s.skirting);
  // Thin highlight along the skirting's top edge — reads as a moulding lip.
  ctx.fillStyle = "rgba(255, 246, 226, 0.22)";
  ctx.fillRect(0, yAt(SKIRTING_H), w, Math.max(1, 0.012 * sy));

  // --- 6. THE WALL WASH. Everything above is drawing; this is the part that
  //        actually stops the wall reading as empty. Light falls from above and
  //        decays downward, the ceiling line goes into shadow, and the floor
  //        line sits darker than the middle — so the eye reads a lit surface
  //        with depth instead of one flat value. Multiply, so it darkens
  //        selectively rather than raising overall brightness. ---
  ctx.globalCompositeOperation = "multiply";
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0.0, "#948A7C"); // ceiling line: in shadow
  wash.addColorStop(0.08, "#D5CDBF");
  wash.addColorStop(0.2, "#FFFFFF"); // wash peak, just under the frieze
  wash.addColorStop(0.45, "#F0E9DC");
  wash.addColorStop(0.72, "#CEC5B4");
  wash.addColorStop(1.0, "#A79E8E"); // floor line
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // --- 7. Corners go darker than the middle of the wall. A room whose corners
  //        are as bright as its walls has no volume — it reads as a box. ---
  const corner = Math.min(1.6, lengthM * 0.18);
  if (corner > 0.05) {
    const gl = ctx.createLinearGradient(0, 0, corner * sx, 0);
    gl.addColorStop(0, "#ADA496");
    gl.addColorStop(1, "#FFFFFF");
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, corner * sx, h);
    const gr = ctx.createLinearGradient((lengthM - corner) * sx, 0, lengthM * sx, 0);
    gr.addColorStop(0, "#FFFFFF");
    gr.addColorStop(1, "#ADA496");
    ctx.fillStyle = gr;
    ctx.fillRect((lengthM - corner) * sx, 0, corner * sx, h);
  }

  // --- 8. Hero backdrops: darker still, feathered, no motif. The wall behind
  //        the most important object in a zone has to be the quietest. ---
  const FEATHER = 0.9;
  for (const span of quiet) {
    const g = ctx.createLinearGradient((span.from - FEATHER) * sx, 0, (span.to + FEATHER) * sx, 0);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.22, "#8C8577");
    g.addColorStop(0.78, "#8C8577");
    g.addColorStop(1, "#FFFFFF");
    ctx.fillStyle = g;
    ctx.fillRect((span.from - FEATHER) * sx, 0, (span.to - span.from + FEATHER * 2) * sx, h);
  }
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Clamp, never repeat: the texture already spans exactly one wall segment,
  // and repeating would wrap the corner shading back into the middle.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/** Motif strips for the frieze band. Each is drawn to fill `bandH` exactly and
 * tile along the wall; none of them is ever allowed outside this band. */
function drawFrieze(
  ctx: CanvasRenderingContext2D,
  motif: WallStyle["friezeMotif"],
  x0: number,
  y0: number,
  width: number,
  bandH: number,
  _sx: number,
  quiet: WallSpan[],
  pxPerM: number
) {
  const step = bandH * 1.15;
  ctx.lineWidth = Math.max(1, bandH * 0.07);
  const cy = y0 + bandH / 2;

  for (let x = x0; x < x0 + width; x += step) {
    // Quiet spans stay bare — checked per repeat, in metres.
    if (inAnySpan(quiet, x / pxPerM)) continue;
    const cx = x + step / 2;
    const r = bandH * 0.3;

    switch (motif) {
      case "kawung":
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.45, r * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "parang":
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy - r);
        ctx.stroke();
        break;
      case "artDeco":
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.stroke();
        break;
      case "purba":
        // Deliberately NOT batik: chevrons and dots, the kind of mark found on
        // prehistoric surfaces, so the zone doesn't borrow a much later idiom.
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r * 0.6);
        ctx.lineTo(cx, cy - r * 0.6);
        ctx.lineTo(cx + r, cy + r * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.05, Math.max(1, r * 0.14), 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        break;
    }
  }
}
