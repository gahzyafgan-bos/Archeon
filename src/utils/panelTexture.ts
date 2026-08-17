import * as THREE from "three";

/**
 * Text drawn into a canvas texture rather than a drei <Html> label.
 *
 * Same reason as the greeter name plate (see greeterPhoto.ts): <Html> is DOM,
 * positioned once from the main camera, so in Mode VR — where the scene is
 * rendered twice into an offscreen target — it lands in the wrong place or not
 * at all. A texture is ordinary geometry and works in both eyes.
 */

/**
 * Everything below is authored in a 1024x640 design space and rasterised into a
 * smaller canvas via `ctx.scale`. 768x480 is ~240 px per metre on a 3.2 m board
 * — still crisp at reading distance — and costs 1.5 MB of texture memory per
 * panel instead of 2.6 MB, which matters when a hall carries several of them.
 */
const DESIGN_W = 1024;
const DESIGN_H = 640;
const PANEL_W = 768;
const PANEL_H = 480;

/** Scales the context into the design space; call right after getContext. */
function enterDesignSpace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.scale(w / DESIGN_W, h / DESIGN_H);
}

/** Naive greedy wrap — enough for the short paragraphs these panels carry. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Interpretive panel: zone title + a short introductory paragraph. This is the
 * one wall element that fills a surface AND does a job — a visitor who reads it
 * understands what the zone in front of them is. Text comes from roomConfig, in
 * Indonesian; nothing internal ever reaches this canvas.
 */
export function createInterpretivePanelTexture(title: string, body: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return empty;
  }

  enterDesignSpace(ctx, PANEL_W, PANEL_H);

  // Warm paper ground, slightly graded so the board isn't a flat rectangle
  // against a wall that now has a gradient of its own.
  const bg = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  bg.addColorStop(0, "#F4ECDC");
  bg.addColorStop(1, "#E6DAC0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  const pad = 64;

  ctx.fillStyle = accent;
  ctx.fillRect(pad, 96, 96, 6);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#3A2C1C";
  ctx.font = "600 62px Georgia, 'Times New Roman', serif";
  const titleLines = wrap(ctx, title.toUpperCase(), DESIGN_W - pad * 2);
  let y = 136;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 74;
  }

  y += 18;
  ctx.fillStyle = "#4A3A28";
  ctx.font = "400 34px Georgia, 'Times New Roman', serif";
  for (const line of wrap(ctx, body, DESIGN_W - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 48;
    if (y > DESIGN_H - pad) break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Shallow relief for the prehistoric zone: hand stencils, chevrons and a fauna
 * silhouette on a rough stone ground.
 *
 * Deliberately NOT batik — batik belongs to a period many thousands of years
 * later than anything in this zone, and the brief is explicit that the
 * prehistoric wall should read as stone and cave rather than as gallery
 * plaster. Painted, not modelled: forty little boxes stuck on a wall is what
 * this replaces.
 */
export function createStoneReliefTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return empty;
  }
  enterDesignSpace(ctx, PANEL_W, PANEL_H);
  const W = DESIGN_W;
  const H = DESIGN_H;

  ctx.fillStyle = "#7A6549";
  ctx.fillRect(0, 0, W, H);

  // Rough stone: deterministic mottling, then a soft top-down light so the
  // panel isn't a flat rectangle on a wall that now has a gradient.
  let seed = 20240729;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 3 + rnd() * 22;
    ctx.fillStyle = rnd() > 0.5 ? "rgba(52, 40, 26, 0.08)" : "rgba(214, 196, 165, 0.07)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.62, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Negative-space hand stencil — palm plus five fingers, the way they are
   * actually found: pigment sprayed AROUND the hand, so the hand is the light
   * shape and the surround is the dark one. */
  const hand = (cx: number, cy: number, scale: number, tilt: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(150, 62, 34, 0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 78, 92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C4B191";
    ctx.beginPath();
    ctx.ellipse(0, 14, 34, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    const fingers: Array<[number, number, number]> = [
      [-40, -8, -0.9],
      [-18, -34, -0.32],
      [2, -40, 0],
      [22, -32, 0.34],
      [40, 6, 1.0],
    ];
    for (const [fx, fy, fr] of fingers) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(fr);
      ctx.beginPath();
      ctx.ellipse(0, -16, 9, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  hand(196, 268, 1.0, -0.12);
  hand(352, 336, 0.78, 0.22);

  // Chevron/tally register — the simplest deliberate mark there is.
  ctx.strokeStyle = "rgba(58, 42, 26, 0.42)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const x = 528 + i * 52;
    ctx.beginPath();
    ctx.moveTo(x, 196);
    ctx.lineTo(x + 26, 152);
    ctx.lineTo(x + 52, 196);
    ctx.stroke();
  }

  // Fauna silhouette — a heavy-bodied, short-legged animal, matching the
  // buffalo/crocodile fossil material this zone actually holds.
  ctx.fillStyle = "rgba(52, 36, 22, 0.5)";
  ctx.beginPath();
  ctx.ellipse(700, 420, 132, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(830, 384, 48, 34, -0.25, 0, Math.PI * 2);
  ctx.fill();
  for (const [lx, ly] of [
    [618, 486],
    [664, 492],
    [742, 492],
    [788, 486],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.rect(lx - 11, ly - 6, 22, 74);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(872, 366);
  ctx.lineTo(906, 330);
  ctx.lineTo(886, 372);
  ctx.closePath();
  ctx.fill();

  const light = ctx.createLinearGradient(0, 0, 0, H);
  light.addColorStop(0, "rgba(255, 246, 226, 0.16)");
  light.addColorStop(0.5, "rgba(255, 246, 226, 0.02)");
  light.addColorStop(1, "rgba(28, 20, 12, 0.20)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

/*
 * An older `createSignPlateTexture` used to live here: gold serif capitals
 * engraved on a plain brass plate, used for the "INFORMASI" plate on the
 * welcome counter. It went with the counter (see Hall.tsx).
 *
 * That exact form is not coming back — large serif capitals on bare brass read
 * as a memorial plaque, not as museum signage. What follows is the museum's
 * actual signage system: painted plates that mount on the wall/lintel/post
 * system, in the same warm palette as the interpretive panels above.
 */

/** Canvas pixels per metre of plate. 320 px/m gives ~32 px of glyph height for
 * a 10 cm cap — crisp at the 2-4 m a visitor actually reads signage from,
 * without paying for a texture nobody can resolve. */
const SIGN_PX_PER_M = 320;
/** Georgia's cap height is close to 0.7 em, so this converts a real-world cap
 * height (the thing signage is actually specified in) into a font size. */
const CAP_HEIGHT_RATIO = 0.7;

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  return ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
}

/** Draws `text` centred on `cx` with letter tracking (canvas has no tracking of
 * its own in every engine we target, so it is applied glyph by glyph). */
function fillTextTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number
) {
  let x = cx - trackedWidth(ctx, text, tracking) / 2;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
}

export interface SignPlateOptions {
  title: string;
  subtitle?: string;
  /** Plate size in metres — the canvas matches its aspect so glyphs never stretch. */
  widthM: number;
  heightM: number;
  /** Plate ground: warm wood #7A5230 or indigo #2E4A7D. */
  ground: string;
  /** Letter colour: ivory #F2E9D8 or brass #B08D3C. */
  ink: string;
  /** Hairline rule/border colour — usually the zone accent. */
  accent: string;
  /**
   * Cap height of the title IN METRES. Signage is specified in physical letter
   * height, not in screen size: 8-15 cm for a zone name is the museum norm and
   * is what makes a sign read as a plate on a wall instead of as a tooltip.
   * Nothing here ever scales with camera distance.
   */
  titleCapM: number;
}

/**
 * Painted signage plate, drawn into a canvas texture for use as an ordinary
 * mesh material.
 *
 * This deliberately replaces the drei <Html> labels the zone signboards, the
 * archway destination labels and the hall welcome banner used to be. <Html> is
 * DOM: it is positioned once, from the main camera, and composited over the
 * whole canvas. In Mode VR the scene is drawn twice into two half-width eye
 * viewports, so a single DOM label lands straddling the seam between them —
 * the left eye sees the left half of the words and the right eye the right
 * half. That is not a cosmetic bug: the two eyes get images that cannot fuse,
 * which is binocular rivalry, and it makes people ill within seconds. A
 * textured mesh is drawn by each eye pass like everything else, occludes
 * behind walls, and holds a fixed real-world size.
 */
export function createSignPlateTexture(opts: SignPlateOptions): THREE.CanvasTexture {
  const { title, subtitle, widthM, heightM, ground, ink, accent, titleCapM } = opts;
  const canvas = document.createElement("canvas");
  const W = Math.round(widthM * SIGN_PX_PER_M);
  const H = Math.round(heightM * SIGN_PX_PER_M);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return empty;
  }

  // Ground, very slightly graded top-to-bottom so the plate catches the hall's
  // overhead light the way a real painted board does.
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(255, 246, 226, 0.10)");
  shade.addColorStop(0.55, "rgba(255, 246, 226, 0.0)");
  shade.addColorStop(1, "rgba(20, 12, 4, 0.18)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Inset hairline border — the detail that reads "made object" rather than
  // "rounded rectangle from a UI kit".
  const inset = Math.round(H * 0.09);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, Math.round(H * 0.018));
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  const pad = inset * 2.4;
  const maxTextW = W - pad * 2;
  const hasSub = !!subtitle;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = ink;

  let titlePx = (titleCapM * SIGN_PX_PER_M) / CAP_HEIGHT_RATIO;
  const tracking = () => titlePx * 0.09;
  const setTitleFont = () => (ctx.font = `600 ${Math.round(titlePx)}px Georgia, 'Times New Roman', serif`);
  setTitleFont();
  // Long zone names must not overflow the plate; shrink to fit rather than
  // clip or wrap, since these are one-line names by design.
  while (titlePx > 8 && trackedWidth(ctx, title, tracking()) > maxTextW) {
    titlePx *= 0.94;
    setTitleFont();
  }

  const titleY = hasSub ? H * 0.4 : H * 0.5;
  fillTextTracked(ctx, title, W / 2, titleY, tracking());

  if (subtitle) {
    let subPx = titlePx * 0.44;
    const setSubFont = () => (ctx.font = `400 ${Math.round(subPx)}px Georgia, 'Times New Roman', serif`);
    setSubFont();
    while (subPx > 6 && trackedWidth(ctx, subtitle, subPx * 0.04) > maxTextW) {
      subPx *= 0.94;
      setSubFont();
    }
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.78;
    fillTextTracked(ctx, subtitle, W / 2, H * 0.72, subPx * 0.04);
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

export interface HistoryPanelTextureOptions {
  title: string;
  subtitle?: string;
  body: string[];
  /**
   * Width of the PRINTED BOARD in metres — the plane this texture is mapped
   * onto, not the outer frame. The canvas is rasterised at exactly this
   * board's aspect so a cap height asked for in metres arrives on the wall at
   * that size in both axes. (It used to be generated at the outer frame's
   * aspect and then stretched onto a board 16 cm smaller in each direction,
   * which made the horizontal and vertical scales differ by 4% and quietly
   * shrank the body text from the 4.5 cm it asked for to 4.06 cm.)
   */
  widthM: number;
  /** The board is never drawn shorter than this, even if the text needs less. */
  minHeightM: number;
  /**
   * Soft ceiling on board height. The layout tightens leading, then body size
   * (never past HISTORY_BODY_CAP_MIN_M), to try to stay under it — but if the
   * text still does not fit, the BOARD GROWS. Text is never dropped: a museum
   * panel that stops mid-sentence is worse than a tall one.
   */
  maxHeightM: number;
  accent: string;
  ground: string;
  ink: string;
  /** Physical cap height of the title, metres. Shrunk further if a single word can't fit the width. */
  titleCapM?: number;
  /** Physical cap height of the body text, metres. */
  bodyCapM?: number;
  maxAnisotropy?: number;
}

export interface HistoryPanelTexture {
  texture: THREE.CanvasTexture;
  /**
   * Board height the caller MUST give the mesh. Derived from the measured
   * text, so the geometry follows the content instead of the content being
   * cropped to the geometry.
   */
  heightM: number;
  /** True when the text needed more room than `maxHeightM` allowed (board grew anyway). */
  overflowed: boolean;
}

/** Canvas pixels per metre of board. 512 gives ~23 px of cap height at 4.5 cm. */
const HISTORY_PX_PER_M = 512;
/** Brass hairline border, measured in from the board edge. */
const HISTORY_INSET_M = 0.05;
/** Inner border -> text. P1.5 asks for >= 8 cm on every side; this is 10. */
const HISTORY_TEXT_PAD_M = 0.1;
const HISTORY_TITLE_CAP_M = 0.11;
const HISTORY_SUB_CAP_M = 0.05;
const HISTORY_BODY_CAP_M = 0.045;
/**
 * Hard legibility floor for body text on a wall panel read from 2-2.5 m. The
 * compression ladder below stops here and grows the board instead — shrinking
 * type past this to win space is exactly the compromise the brief forbids.
 */
const HISTORY_BODY_CAP_MIN_M = 0.035;
/** Georgia's cap height is ~0.7 em. */
const HISTORY_CAP_RATIO = 0.7;

/** Leading as a multiple of font size, from most to least generous. Never below 1.3. */
const HISTORY_LEADING_LADDER = [1.45, 1.4, 1.35, 1.3];

interface HistoryLayout {
  titleFontPx: number;
  titleLines: string[];
  subFontPx: number;
  bodyFontPx: number;
  lineSpacing: number;
  paragraphSpacing: number;
  bodyLines: string[][];
  /** Distance from the top of the text column to the first body baseline slot. */
  headerH: number;
  /** Text-column height: header + every body line + every paragraph gap. */
  contentH: number;
}

function historyFont(px: number, weight: string) {
  return `${weight} ${Math.round(px)}px Georgia, 'Times New Roman', serif`;
}

/**
 * Measures the whole panel without drawing it.
 *
 * Separating measurement from drawing is the actual fix for "teks kepotong":
 * the previous version discovered it had run out of room only while painting,
 * at which point its only move was `break` — silently discarding the rest of
 * the museum's own history. Here the height is a RESULT of the text, so there
 * is no state in which a line exists and has nowhere to go.
 */
function layoutHistoryPanel(
  ctx: CanvasRenderingContext2D,
  opts: {
    title: string;
    subtitle?: string;
    body: string[];
    maxTextW: number;
    titleCapM: number;
    bodyCapM: number;
    leading: number;
  }
): HistoryLayout {
  const { title, subtitle, body, maxTextW, titleCapM, bodyCapM, leading } = opts;

  // Title: shrink only if an unbreakable word overruns the column — wrapping
  // handles everything else, so the cap height stays at its specified size in
  // the normal case.
  let titleFontPx = (titleCapM * HISTORY_PX_PER_M) / HISTORY_CAP_RATIO;
  const longestWord = title.split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), "");
  for (let guard = 0; guard < 40; guard++) {
    ctx.font = historyFont(titleFontPx, "600");
    if (ctx.measureText(longestWord).width <= maxTextW || titleFontPx <= 12) break;
    titleFontPx *= 0.94;
  }
  ctx.font = historyFont(titleFontPx, "600");
  const titleLines = wrap(ctx, title, maxTextW);

  const subFontPx = (HISTORY_SUB_CAP_M * HISTORY_PX_PER_M) / HISTORY_CAP_RATIO;
  const bodyFontPx = (bodyCapM * HISTORY_PX_PER_M) / HISTORY_CAP_RATIO;
  const lineSpacing = bodyFontPx * leading;
  const paragraphSpacing = bodyFontPx * (leading - 0.9);

  ctx.font = historyFont(bodyFontPx, "400");
  const bodyLines = body.map((p) => wrap(ctx, p, maxTextW));

  // Header block, top of the text column downward.
  const accentBarH = 0.012 * HISTORY_PX_PER_M;
  const afterBar = 0.03 * HISTORY_PX_PER_M;
  const subGap = subtitle ? 0.012 * HISTORY_PX_PER_M : 0;
  const subBlock = subtitle ? subFontPx * 1.3 : 0;
  const dividerGap = 0.028 * HISTORY_PX_PER_M;
  const dividerH = 0.004 * HISTORY_PX_PER_M;
  // P1.5: at least 1.5 line-heights of air between the title block and the
  // first paragraph, whatever the subtitle/divider happen to contribute.
  const preBody = subGap + subBlock + dividerGap + dividerH;
  const afterDivider = Math.max(0.045 * HISTORY_PX_PER_M, lineSpacing * 1.5 - preBody);

  const headerH = accentBarH + afterBar + titleLines.length * titleFontPx * 1.22 + preBody + afterDivider;

  const totalLines = bodyLines.reduce((n, lines) => n + lines.length, 0);
  const gaps = Math.max(0, bodyLines.length - 1);
  const contentH = headerH + totalLines * lineSpacing + gaps * paragraphSpacing;

  return {
    titleFontPx,
    titleLines,
    subFontPx,
    bodyFontPx,
    lineSpacing,
    paragraphSpacing,
    bodyLines,
    headerH,
    contentH,
  };
}

/**
 * High-density history panel texture for the museum's wall pigoras.
 *
 * The board's HEIGHT is an output, not an input: the caller supplies a width
 * and a min/max, the text is measured, and the returned `heightM` is whatever
 * it takes to show every paragraph with real padding at a legible size. See
 * WelcomeHistoryPanels, which builds its frame geometry from that number.
 */
export function createHistoryPanelTexture(opts: HistoryPanelTextureOptions): HistoryPanelTexture {
  const {
    title,
    subtitle,
    body,
    widthM,
    minHeightM,
    maxHeightM,
    accent,
    ground,
    ink,
    titleCapM = HISTORY_TITLE_CAP_M,
    bodyCapM = HISTORY_BODY_CAP_M,
    maxAnisotropy = 8,
  } = opts;

  const W = Math.round(widthM * HISTORY_PX_PER_M);
  const pad = (HISTORY_INSET_M + HISTORY_TEXT_PAD_M) * HISTORY_PX_PER_M;
  const maxTextW = W - pad * 2;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = W;
    canvas.height = Math.max(2, Math.round(minHeightM * HISTORY_PX_PER_M));
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return { texture: empty, heightM: minHeightM, overflowed: false };
  }

  // --- Fit ladder ---------------------------------------------------------
  // Tighten leading first (cheap, invisible), then body size, and only down to
  // the legibility floor. Whatever survives, the board takes the height the
  // text needs — the ladder decides how tall, never whether the text fits.
  const maxContentH = (maxHeightM - 2 * (HISTORY_INSET_M + HISTORY_TEXT_PAD_M)) * HISTORY_PX_PER_M;
  let layout = layoutHistoryPanel(ctx, {
    title,
    subtitle,
    body,
    maxTextW,
    titleCapM,
    bodyCapM,
    leading: HISTORY_LEADING_LADDER[0],
  });
  if (layout.contentH > maxContentH) {
    outer: for (const leading of HISTORY_LEADING_LADDER) {
      for (let cap = bodyCapM; cap >= HISTORY_BODY_CAP_MIN_M - 1e-9; cap -= 0.0025) {
        const candidate = layoutHistoryPanel(ctx, {
          title,
          subtitle,
          body,
          maxTextW,
          titleCapM,
          bodyCapM: Math.max(HISTORY_BODY_CAP_MIN_M, cap),
          leading,
        });
        layout = candidate;
        if (candidate.contentH <= maxContentH) break outer;
      }
    }
  }
  const overflowed = layout.contentH > maxContentH;

  const neededH = layout.contentH + pad * 2;
  const H = Math.max(Math.round(minHeightM * HISTORY_PX_PER_M), Math.ceil(neededH));
  const heightM = H / HISTORY_PX_PER_M;
  // Any height the text did not ask for becomes extra breathing room, split
  // evenly top and bottom rather than pooling under the last line.
  const slack = Math.max(0, H - neededH) / 2;

  if (import.meta.env.DEV) {
    // P1.6: prove no character was lost between the data and the canvas. The
    // wrapper is the only thing between them, so re-joining its output must
    // reproduce the paragraph exactly.
    body.forEach((p, i) => {
      const rejoined = layout.bodyLines[i].join(" ");
      const normalized = p.replace(/\s+/g, " ").trim();
      if (rejoined !== normalized) {
        console.warn(`[historyPanel] "${title}" paragraf ${i + 1} berubah saat dibungkus baris.`, {
          expected: normalized,
          got: rejoined,
        });
      }
    });
    if (overflowed) {
      console.warn(
        `[historyPanel] "${title}" butuh ${heightM.toFixed(2)} m padahal maxHeightM ${maxHeightM} m — ` +
          `papan diperbesar (teks TIDAK dipotong). Perlebar panel atau naikkan maxHeight.`
      );
    }
  }

  canvas.width = W;
  canvas.height = H;

  // Rich layered ground with subtle vertical lighting gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, ground);
  bg.addColorStop(1, "#1B2F52");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft overhead light wash simulation
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(255, 246, 226, 0.08)");
  shade.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.24)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Inset brass hairline border — a fixed real-world inset now, so a taller
  // board doesn't get a proportionally fatter frame than a short one.
  const inset = Math.round(HISTORY_INSET_M * HISTORY_PX_PER_M);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, Math.round(0.007 * HISTORY_PX_PER_M));
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  // Corner flourishes
  const cornerLen = Math.round(0.06 * HISTORY_PX_PER_M);
  ctx.lineWidth = Math.max(4, Math.round(0.011 * HISTORY_PX_PER_M));
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + cornerLen * sy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + cornerLen * sx, cy);
    ctx.stroke();
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  let y = pad + slack;

  // Accent bar above title
  ctx.fillStyle = accent;
  const accentBarH = 0.012 * HISTORY_PX_PER_M;
  ctx.fillRect(pad, y, Math.round(W * 0.1), Math.max(4, Math.round(accentBarH)));
  y += accentBarH + 0.03 * HISTORY_PX_PER_M;

  const shadowOn = () => {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  };
  const shadowOff = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  shadowOn();

  ctx.font = historyFont(layout.titleFontPx, "600");
  ctx.fillStyle = accent;
  for (const line of layout.titleLines) {
    ctx.fillText(line, pad, y);
    y += layout.titleFontPx * 1.22;
  }

  if (subtitle) {
    y += 0.012 * HISTORY_PX_PER_M;
    ctx.font = `italic ${historyFont(layout.subFontPx, "400")}`;
    ctx.fillStyle = "#E4D5B7";
    ctx.fillText(subtitle, pad, y);
    y += layout.subFontPx * 1.3;
  }

  shadowOff();

  y += 0.028 * HISTORY_PX_PER_M;
  ctx.strokeStyle = "rgba(232, 160, 32, 0.4)";
  const dividerH = 0.004 * HISTORY_PX_PER_M;
  ctx.lineWidth = Math.max(1, Math.round(dividerH));
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += dividerH;

  const preBody =
    (subtitle ? 0.012 * HISTORY_PX_PER_M + layout.subFontPx * 1.3 : 0) +
    0.028 * HISTORY_PX_PER_M +
    dividerH;
  y += Math.max(0.045 * HISTORY_PX_PER_M, layout.lineSpacing * 1.5 - preBody);

  shadowOn();

  ctx.font = historyFont(layout.bodyFontPx, "400");
  ctx.fillStyle = ink;

  // No bounds check, and that is the point: the canvas was sized from these
  // exact lines, so every one of them has a place to land.
  layout.bodyLines.forEach((lines, i) => {
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += layout.lineSpacing;
    }
    if (i < layout.bodyLines.length - 1) y += layout.paragraphSpacing;
  });

  shadowOff();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;
  return { texture, heightM, overflowed };
}

