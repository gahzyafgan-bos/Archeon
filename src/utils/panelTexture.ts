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
 * `createSignPlateTexture` used to live here: gold serif capitals engraved on
 * a plain brass plate, used for the "INFORMASI" plate on the welcome counter.
 * It went with the counter (see Hall.tsx).
 *
 * It is not coming back in this form. Large serif capitals on bare brass read
 * as a memorial plaque, not as museum signage, and the museum already has a
 * signage system that works: the zone signboards and the wall-mounted
 * interpretive panels above, both of which sit in the wall system rather than
 * being screwed onto a piece of furniture. Anything that needs a label should
 * join that system instead of reintroducing this one.
 */
