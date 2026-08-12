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
  widthM: number;
  heightM: number;
  accent: string;
  ground: string;
  ink: string;
  maxAnisotropy?: number;
}

/**
 * High-density history panel texture generator for museum wall pigoras.
 * Renders crisp, legibly-typeset multi-paragraph Indonesian text onto a rich
 * Batik Modern background with brass frame accents and exact world-scale font height.
 */
export function createHistoryPanelTexture(opts: HistoryPanelTextureOptions): THREE.CanvasTexture {
  const { title, subtitle, body, widthM, heightM, accent, ground, ink, maxAnisotropy = 8 } = opts;

  // High DPI rasterisation: 512 px per metre on world scale
  const PX_PER_M = 512;
  const W = Math.round(widthM * PX_PER_M);
  const H = Math.round(heightM * PX_PER_M);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    empty.colorSpace = THREE.SRGBColorSpace;
    return empty;
  }

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

  // Inset brass hairline border
  const inset = Math.round(H * 0.045);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, Math.round(H * 0.008));
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  // Corner flourishes
  const cornerLen = Math.round(H * 0.055);
  ctx.lineWidth = Math.max(4, Math.round(H * 0.012));
  // Top-left
  ctx.beginPath();
  ctx.moveTo(inset, inset + cornerLen);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + cornerLen, inset);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(W - inset - cornerLen, inset);
  ctx.lineTo(W - inset, inset);
  ctx.lineTo(W - inset, inset + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(inset, H - inset - cornerLen);
  ctx.lineTo(inset, H - inset);
  ctx.lineTo(inset + cornerLen, H - inset);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(W - inset - cornerLen, H - inset);
  ctx.lineTo(W - inset, H - inset);
  ctx.lineTo(W - inset, H - inset - cornerLen);
  ctx.stroke();

  const padX = inset * 2.2;
  const padY = inset * 1.8;
  const maxTextW = W - padX * 2;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Accent bar above title
  ctx.fillStyle = accent;
  ctx.fillRect(padX, padY, Math.round(W * 0.1), Math.max(4, Math.round(H * 0.012)));

  let y = padY + Math.round(H * 0.035);

  // Setup drop shadow for text legibility
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Title: Georgia 600 serif, ~11 cm physical cap height
  const titleCapPx = 0.11 * PX_PER_M;
  const titleFontPx = titleCapPx / 0.7;
  ctx.font = `600 ${Math.round(titleFontPx)}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = accent;

  const titleLines = wrap(ctx, title, maxTextW);
  for (const line of titleLines) {
    ctx.fillText(line, padX, y);
    y += titleFontPx * 1.25;
  }

  // Subtitle
  if (subtitle) {
    y += Math.round(H * 0.008);
    const subCapPx = 0.05 * PX_PER_M;
    const subFontPx = subCapPx / 0.7;
    ctx.font = `italic 400 ${Math.round(subFontPx)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "#E4D5B7";
    ctx.fillText(subtitle, padX, y);
    y += subFontPx * 1.35;
  }

  // Disable shadow for divider line
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Divider line
  y += Math.round(H * 0.012);
  ctx.strokeStyle = "rgba(232, 160, 32, 0.4)";
  ctx.lineWidth = Math.max(1, Math.round(H * 0.003));
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(W - padX, y);
  ctx.stroke();
  y += Math.round(H * 0.022);

  // Re-enable shadow for body text
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Paragraph body text: Georgia 400 serif, ~4.5 cm physical cap height
  const bodyCapPx = 0.045 * PX_PER_M;
  const bodyFontPx = bodyCapPx / 0.7;
  ctx.font = `400 ${Math.round(bodyFontPx)}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = ink;

  const lineSpacing = bodyFontPx * 1.4;
  const paragraphSpacing = bodyFontPx * 0.7;

  for (const p of body) {
    const lines = wrap(ctx, p, maxTextW);
    for (const line of lines) {
      if (y + bodyFontPx > H - padY) break;
      ctx.fillText(line, padX, y);
      y += lineSpacing;
    }
    y += paragraphSpacing;
    if (y > H - padY) break;
  }

  // Reset shadow before exit
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

