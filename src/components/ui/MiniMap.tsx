import { useFrame, useThree } from "@react-three/fiber";
import { ROOM_CONFIGS } from "@/data/roomConfig";
import type { RoomId } from "@/store/useMuseumStore";

/**
 * Optional mini-map (spec section 8). Two halves:
 *  - `MiniMapFrame`: the DOM <canvas> + glass frame, rendered as a normal
 *    sibling of the R3F <Canvas> so it sits in the regular HTML overlay.
 *  - `MiniMapTracker`: mounted *inside* the R3F <Canvas> so it can read
 *    `camera.position` every frame; it draws straight onto the same
 *    <canvas> DOM node via the ref passed down from MuseumExperience.
 */
export function MiniMapFrame({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  return (
    <div className="fixed top-16 right-5 z-20 w-28 h-28 rounded-lg overflow-hidden glass-panel">
      <canvas ref={canvasRef} width={112} height={112} className="w-full h-full" />
    </div>
  );
}

export function MiniMapTracker({
  canvasEl,
  room,
}: {
  canvasEl: HTMLCanvasElement | null;
  room: RoomId;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const { minX, maxX, minZ, maxZ } = ROOM_CONFIGS[room].bounds;
    const w = canvasEl.width;
    const h = canvasEl.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20,20,22,0.4)";
    ctx.fillRect(0, 0, w, h);

    const nx = (camera.position.x - minX) / (maxX - minX);
    const nz = (camera.position.z - minZ) / (maxZ - minZ);
    const px = nx * w;
    const py = nz * h;

    const dirX = Math.sin(camera.rotation.y) * -8;
    const dirZ = Math.cos(camera.rotation.y) * -8;
    ctx.strokeStyle = "#c9a961";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dirX, py + dirZ);
    ctx.stroke();

    ctx.fillStyle = "#c9a961";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  return null;
}
