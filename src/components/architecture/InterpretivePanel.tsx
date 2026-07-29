import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createInterpretivePanelTexture } from "@/utils/panelTexture";

/**
 * Shared by every wall-mounted board in the museum — the interpretive panels
 * here and the prehistoric relief's surround in RoomShell.
 *
 * Created once at module scope and attached by reference (same technique as
 * Greeter.tsx), so a hall with three boards on three different walls still
 * costs two materials for their framing rather than six. Attached via
 * <primitive attach>, which R3F treats as a borrowed object and never disposes.
 */
export const WALL_FURNITURE_MAT = {
  wood: new THREE.MeshStandardMaterial({ color: "#7A5230", roughness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: "#B08D3C", roughness: 0.5, metalness: 0.45 }),
};

/**
 * Wall-mounted zone introduction — a wood-framed board carrying the zone's
 * title and a two-to-three sentence opening paragraph.
 *
 * Of every "lapisan isi" option available for a bare wall this is the only one
 * that pays for itself twice: it occupies wall area AND tells a visitor what
 * they are standing in front of. It is deliberately mounted where nothing is
 * displayed — never behind an artefact, and never on a hero's backdrop wall;
 * the wall texture drops its pilaster line behind each board so no painted
 * rhythm runs up through the middle of the text.
 *
 * Three meshes, one texture, no light of its own: the board sits inside the
 * hall's existing wall wash, which is why it is mounted on the upper, lit part
 * of the wall rather than down near the dado.
 */
export function InterpretivePanel({
  position,
  rotationY,
  title,
  body,
  accent,
  width = 3.2,
  height = 2.0,
}: {
  position: [number, number, number];
  rotationY: number;
  title: string;
  body: string;
  accent: string;
  width?: number;
  height?: number;
}) {
  const texture = useMemo(() => createInterpretivePanelTexture(title, body, accent), [title, body, accent]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[width, height, 0.08]} />
        <primitive object={WALL_FURNITURE_MAT.wood} attach="material" />
      </mesh>
      {/* Brass reveal between frame and board */}
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[width - 0.12, height - 0.12, 0.01]} />
        <primitive object={WALL_FURNITURE_MAT.brass} attach="material" />
      </mesh>
      {/* Board face */}
      <mesh position={[0, 0, 0.055]}>
        <planeGeometry args={[width - 0.22, height - 0.22]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  );
}
