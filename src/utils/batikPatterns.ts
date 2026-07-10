import * as THREE from "three";

// Generate CanvasTexture for batik patterns
export function createBatikPattern(
  type: "kawung" | "parang" | "gajahOling" | "artDeco",
  color1: string,
  color2: string,
  size: number = 256
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
  ctx.fillStyle = color2;
  ctx.strokeStyle = color2;
  ctx.lineWidth = 2;

  const cellSize = size / 8;

  switch (type) {
    case "kawung": {
      // Grid of circles/ellipses
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const cx = cellSize * (i + 0.5);
          const cy = cellSize * (j + 0.5);
          const r = cellSize * 0.4;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 0.5, r * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
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
      // Curved tail/trunk patterns
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
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
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
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
      for (let i = 0; i <= 8; i++) {
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
  return texture;
}
