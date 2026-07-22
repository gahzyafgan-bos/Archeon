import { useMemo } from "react";
import { Pillar } from "./Pillar";
import { createBatikPattern } from "@/utils/batikPatterns";

const BRASS = "#B08D3C";

/**
 * Non-artifact centerpiece for a hall's otherwise-empty geometric middle
 * (spec section 3: "isi titik tengah yang kosong... mata tidak punya
 * tujuan"). A floor medallion + flanking pillars, staged like a hero but
 * without touching artifacts.json — the museum's own mark rather than a
 * piece from the collection, so it doesn't compete with (or require
 * moving) either zone's actual hero.
 *
 * Deliberately floor-only, no wall-mounted crest: an earlier version also
 * planted a 3.6m backing panel on whichever wall sat behind the center
 * point — for Hall 1 that wall is the SAME wall as the archway to Hall 2
 * (both sit at x=0), so the panel ended up mounted directly across the
 * doorway, reading as a dead-end backdrop instead of a passage (the
 * "gerbang tertutup hiasan" bug). The archway itself is now the vista at
 * the far end of this sightline (see RoomShell's ArchwayGlimpse) — this
 * installation's job is just to keep the middle of the floor from feeling
 * empty on the way there, not to claim wall space a doorway might need.
 */
export function CenterInstallation({
  center,
  accentColor,
  shadowsEnabled,
  shadowMapSize,
}: {
  center: { x: number; z: number };
  accentColor: string;
  shadowsEnabled: boolean;
  shadowMapSize: number;
}) {
  const medallionTexture = useMemo(() => createBatikPattern("kawung", "#EDE0C4", accentColor, 128), [accentColor]);

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
