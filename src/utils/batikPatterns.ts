import * as THREE from "three";

/**
 * How big one motif cell is in the world, in metres.
 *
 * Real batik repeats at roughly the scale of a hand. Past ~20 cm a repeat
 * stops reading as cloth and starts reading as polkadot wallpaper, and — worse
 * — it rescales the whole room in the viewer's head: an enormous floor pattern
 * makes the hall feel like a model. Every batik surface derives its UV repeat
 * from this one number via `applyBatikWorldScale`, so the whole museum can be
 * retuned by editing it.
 */
export const BATIK_CELL_M = 0.12;

/** `createBatikPattern` always draws this many cells across one tile. */
export const BATIK_CELLS_PER_TILE = 8;

/** World size of one full texture tile, in metres. */
export const BATIK_TILE_M = BATIK_CELL_M * BATIK_CELLS_PER_TILE;

/**
 * Set a batik texture's UV repeat from the world size of the surface it is
 * mapped onto, so the motif is the same physical size everywhere.
 *
 * Repeats are whole numbers: the pattern tiles cleanly (no motif crosses a
 * tile edge), and a fractional repeat would slice cells in half at the seam.
 * Rounding means the realised cell size drifts a little from BATIK_CELL_M on
 * small surfaces, which is fine — it stays well inside the 8-15 cm band.
 *
 * Call it once, at texture-creation time. Mutating a texture's repeat is what
 * makes it a different texture, so it must not happen per frame.
 */
export function applyBatikWorldScale(
  texture: THREE.CanvasTexture,
  widthM: number,
  heightM: number = widthM
): THREE.CanvasTexture {
  texture.repeat.set(
    Math.max(1, Math.round(widthM / BATIK_TILE_M)),
    Math.max(1, Math.round(heightM / BATIK_TILE_M))
  );
  return texture;
}

/**
 * @param strength Ink opacity, 0-1. Batik on an interior surface has to be a
 *   texture, not a graphic: a difference in value you notice up close and that
 *   dissolves into tone at a distance. At full strength the accent-on-cream
 *   contrast competes with the artefacts, which is the one thing decor here is
 *   never allowed to do. Floors get the lowest value of all — they are the
 *   largest surface in view and should be the quietest.
 */
export function createBatikPattern(
  type: "kawung" | "parang" | "gajahOling" | "artDeco",
  color1: string,
  color2: string,
  size: number = 256,
  strength: number = 1
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    // Fallback if canvas fails
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = strength;
  ctx.fillStyle = color2;
  ctx.strokeStyle = color2;
  ctx.lineWidth = 2;

  const cellSize = size / BATIK_CELLS_PER_TILE;

  switch (type) {
    case "kawung": {
      // Kawung is FOUR ellipses radiating from a shared centre — a quatrefoil,
      // said to be the aren palm fruit sliced across. It was drawn here as one
      // ellipse with a smaller ellipse inside it, i.e. concentric rings, which
      // is not kawung and not any batik motif: at the scale it was rendered it
      // read as a grid of archery targets.
      const petalLong = cellSize * 0.42;
      const petalShort = petalLong * 0.55;
      // Petals sit just off centre along their own long axis so their inner
      // ends meet in the middle instead of overlapping into a blob.
      const offset = petalLong * 0.82;
      // Petals reach 0.76 of a cell from their centre, i.e. past the cell
      // corner at 0.71 — they interlock with the neighbouring quatrefoil, the
      // way real kawung does. That means the outermost petals cross the tile
      // edge, so the ring of cells just outside the tile has to be drawn too:
      // cell -1 is congruent to cell 7, so drawing it paints exactly the part
      // that wraps around from the other side. Without it every tile boundary
      // shows a line of sliced petals — invisible at the old 1x repeat, very
      // visible now that a floor carries 20+ tiles. See seamAudit note below.
      for (let i = -1; i <= BATIK_CELLS_PER_TILE; i++) {
        for (let j = -1; j <= BATIK_CELLS_PER_TILE; j++) {
          const cx = cellSize * (i + 0.5);
          const cy = cellSize * (j + 0.5);
          for (let k = 0; k < 4; k++) {
            const angle = Math.PI / 4 + (k * Math.PI) / 2;
            ctx.beginPath();
            ctx.ellipse(
              cx + Math.cos(angle) * offset,
              cy + Math.sin(angle) * offset,
              petalLong,
              petalShort,
              angle,
              0,
              Math.PI * 2
            );
            ctx.stroke();
          }
          // Small filled centre dot, the way the motif is usually finished.
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "parang": {
      // Diagonal S-shaped lines
      ctx.lineWidth = 3;
      for (let offset = -size; offset < size * 2; offset += cellSize * 2) {
        ctx.beginPath();
        for (let x = 0; x < size; x += 4) {
          const y =
            x +
            offset +
            Math.sin((x / size) * Math.PI * 4) * cellSize * 0.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case "gajahOling": {
      // Curved tail/trunk patterns. Its second arc is centred 0.4 of a cell
      // off and has a 0.3 radius, so it reaches 1.2 cells from the cell origin
      // and crosses the tile edge — same overdraw ring as kawung, same reason.
      for (let i = -1; i <= BATIK_CELLS_PER_TILE; i++) {
        for (let j = -1; j <= BATIK_CELLS_PER_TILE; j++) {
          const cx = cellSize * (i + 0.5);
          const cy = cellSize * (j + 0.5);
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(
            cx + cellSize * 0.4,
            cy + cellSize * 0.4,
            cellSize * 0.3,
            Math.PI,
            Math.PI * 2.5
          );
          ctx.stroke();
        }
      }
      break;
    }
    case "artDeco": {
      // Geometric grid with diamonds
      ctx.lineWidth = 2;
      for (let i = 0; i < BATIK_CELLS_PER_TILE; i++) {
        for (let j = 0; j < BATIK_CELLS_PER_TILE; j++) {
          const cx = cellSize * (i + 0.5);
          const cy = cellSize * (j + 0.5);
          const s = cellSize * 0.3;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s, cy);
          ctx.lineTo(cx, cy + s);
          ctx.lineTo(cx - s, cy);
          ctx.closePath();
          ctx.stroke();
        }
      }
      // Grid lines
      ctx.lineWidth = 1;
      for (let i = 0; i <= BATIK_CELLS_PER_TILE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(size, i * cellSize);
        ctx.stroke();
      }
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Correct repeats put 20+ tiles across a floor where there used to be one,
  // so these surfaces are now heavily minified at grazing angles — which is
  // exactly where an unfiltered tiled pattern turns into crawling moire.
  // Canvas sizes here are powers of two, so mipmaps are available; three.js
  // clamps the anisotropy request to whatever the device actually supports.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}
