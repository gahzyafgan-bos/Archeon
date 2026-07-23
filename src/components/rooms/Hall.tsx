import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { RoomShell } from "./RoomShell";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { useIsOverlayActive } from "@/hooks/useIsOverlayActive";

const WELCOME_TRIGGER_RADIUS = 5;

/**
 * Renders one hall's geometry + artifacts (via RoomShell) plus any
 * hall-specific set dressing that doesn't belong in the generic zone-driven
 * decor loop. Today that's just the welcome-desk grouping in Hall 1 — the
 * old Lobby/GalleryRoom split doesn't apply anymore since a hall now mixes
 * a "welcome" zone with collection zones in the same open space.
 */
export function Hall({ hall, artifacts }: { hall: RoomConfig; artifacts: Artifact[] }) {
  const welcomeZone = hall.zones.find((z) => z.id === "welcome");
  const { camera } = useThree();
  const [showWelcome, setShowWelcome] = useState(false);
  const isOverlayActive = useIsOverlayActive();

  useFrame(() => {
    if (!welcomeZone) return;
    const dx = camera.position.x - welcomeZone.center.x;
    const dz = camera.position.z - welcomeZone.center.z;
    const near = dx * dx + dz * dz < WELCOME_TRIGGER_RADIUS * WELCOME_TRIGGER_RADIUS;
    if (near !== showWelcome) setShowWelcome(near);
  });

  return (
    <RoomShell room={hall} artifacts={artifacts}>
      {welcomeZone && (
        <group position={[welcomeZone.center.x, 0, welcomeZone.center.z]}>
          {/* Reception desk */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 1, 0.9]} />
            <meshStandardMaterial color="#4a3020" roughness={0.7} />
          </mesh>
          <group position={[0, 1, -0.7]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
              <meshStandardMaterial color="#a05030" roughness={0.82} />
            </mesh>
            <mesh position={[0, 1.55, 0]} castShadow>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshStandardMaterial color="#d9c0a8" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.72, 0]} castShadow>
              <coneGeometry args={[0.24, 0.22, 12]} />
              <meshStandardMaterial color="#2a2520" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.2, 0.1]} rotation={[0.2, 0, 0]} castShadow>
              <boxGeometry args={[0.5, 0.05, 0.8]} />
              <meshStandardMaterial color="#c08050" roughness={0.75} />
            </mesh>
          </group>
          <spotLight position={[0, 4.5, -0.5]} angle={0.5} penumbra={0.6} intensity={30} color="#E8A020" />

          {showWelcome && !isOverlayActive && (
            <Html position={[0, 2.6, 1.5]} center distanceFactor={8} zIndexRange={[1, 0]}>
              <div className="glass-panel rounded-lg px-5 py-3 text-center animate-fade-in whitespace-nowrap pointer-events-none">
                <p className="font-display text-museum-bone text-lg tracking-wide">
                  Selamat Datang di Museum Mpu Tantular Virtual
                </p>
                <p className="text-museum-mist text-xs mt-1">
                  Ikuti jalur di lantai menuju Koleksi Prasejarah &amp; Galeri Hindu-Buddha
                </p>
              </div>
            </Html>
          )}
        </group>
      )}
    </RoomShell>
  );
}
