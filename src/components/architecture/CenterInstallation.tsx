import { useMemo } from "react";
import * as THREE from "three";
import type { RoomBounds } from "@/data/roomConfig";
import { Pillar } from "./Pillar";
import { createBatikPattern } from "@/utils/batikPatterns";

const WOOD_COLOR = "#7A5230";
const BRASS = "#B08D3C";

/**
 * Non-artifact centerpiece for a hall's otherwise-empty geometric middle
 * (spec section 3: "isi titik tengah yang kosong... mata tidak punya
 * tujuan"). A floor medallion + wall crest + flanking pillars, staged like
 * a hero but without touching artifacts.json — the museum's own mark
 * rather than a piece from the collection, so it doesn't compete with (or
 * require moving) either zone's actual hero.
 */
export function CenterInstallation({
  center,
  bounds,
  accentColor,
  shadowsEnabled,
  shadowMapSize,
}: {
  center: { x: number; z: number };
  bounds: RoomBounds;
  accentColor: string;
  shadowsEnabled: boolean;
  shadowMapSize: number;
}) {
  const medallionTexture = useMemo(() => createBatikPattern("kawung", "#EDE0C4", accentColor, 128), [accentColor]);
  const crestTexture = useMemo(() => createBatikPattern("kawung", "#EDE0C4", accentColor, 128), [accentColor]);

  // Crest panel sits on whichever short wall is behind the center point
  // (the far end of the sightline from spawn) — same "nearest wall" logic
  // as a zone's hero backdrop, but for the hall's own center axis.
  const wallZ = center.z < (bounds.minZ + bounds.maxZ) / 2 ? bounds.minZ + 0.15 : bounds.maxZ - 0.15;
  const faceSign = center.z < (bounds.minZ + bounds.maxZ) / 2 ? 1 : -1;

  return (
    <group>
      {/* Floor medallion */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.016, center.z]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial map={medallionTexture} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.017, center.z]}>
        <ringGeometry args={[1.55, 1.62, 48]} />
        <meshStandardMaterial color={BRASS} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Flanking pillars, mirroring the hero-framing pillar language used
          elsewhere so this reads as staged rather than incidental. */}
      <Pillar height={3.2} radius={0.26} style="candi" accentColor={accentColor} position={[center.x - 1.8, 0, center.z]} />
      <Pillar height={3.2} radius={0.26} style="candi" accentColor={accentColor} position={[center.x + 1.8, 0, center.z]} />

      {/* Wall crest — the museum's own mark, wider than a single hero
          backdrop since it closes off the hall's full center axis. */}
      <mesh position={[center.x, 3.4, wallZ]} receiveShadow>
        <boxGeometry args={[3.6, 4.6, 0.14]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[center.x, 3.4, wallZ + faceSign * 0.075]}>
        <boxGeometry args={[3.2, 4.2, 0.02]} />
        <meshStandardMaterial map={crestTexture} emissive={accentColor} emissiveIntensity={0.12} roughness={0.55} />
      </mesh>
      <mesh position={[center.x, 3.4, wallZ + faceSign * 0.09]}>
        <ringGeometry args={[0.55, 0.68, 32]} />
        <meshStandardMaterial color={BRASS} roughness={0.4} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Focal spotlight — the one extra dynamic light this installation
          adds hall-wide; kept unconditional (like the Garudeya vitrine
          spotlight) since it's what makes the center actually read as a
          destination rather than empty floor. */}
      <spotLight
        position={[center.x, 5.5, center.z + 0.5]}
        angle={0.32}
        penumbra={0.5}
        intensity={35}
        color={accentColor}
        castShadow={shadowsEnabled}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
      />
    </group>
  );
}
