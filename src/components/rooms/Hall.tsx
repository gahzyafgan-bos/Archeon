import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { RoomShell } from "./RoomShell";
import { Greeter } from "@/components/architecture/Greeter";
import { getGreetersForRoom } from "@/data/greeters";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { useIsOverlayActive } from "@/hooks/useIsOverlayActive";

const WELCOME_TRIGGER_RADIUS = 5;

/**
 * Renders one hall's geometry + artifacts (via RoomShell) plus any
 * hall-specific set dressing that doesn't belong in the generic zone-driven
 * decor loop. Today that's the welcome-zone grouping in Hall 1 — the
 * old Lobby/GalleryRoom split doesn't apply anymore since a hall now mixes
 * a "welcome" zone with collection zones in the same open space.
 *
 * The two greeters are NOT part of that set dressing: they come from
 * src/data/greeters.ts in world coordinates and are rendered by map(), so
 * adding, moving or re-photographing one is a data edit.
 */
export function Hall({ hall, artifacts }: { hall: RoomConfig; artifacts: Artifact[] }) {
  const welcomeZone = hall.zones.find((z) => z.id === "welcome");
  const greeters = getGreetersForRoom(hall.id);
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
      {greeters.map((greeter) => (
        <Greeter key={greeter.id} greeter={greeter} />
      ))}

      {welcomeZone && (
        <group position={[welcomeZone.center.x, 0, welcomeZone.center.z]}>
          {/* Information counter, moved off the entry axis (it used to sit dead
              centre, 0.8 m in front of the spawn point, blocking both the
              walkway and the sightline into the hall). It reads as furniture at
              the side of the lobby now; the greeting itself is done by the two
              people flanking the aisle, not by the desk. */}
          <group position={[-3.4, 0, 0.2]} rotation={[0, 0.42, 0]}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.4, 1, 0.8]} />
              <meshStandardMaterial color="#4a3020" roughness={0.7} />
            </mesh>
            {/* Counter top lip, brass, so it doesn't read as a plain crate. */}
            <mesh position={[0, 1.02, 0]} receiveShadow>
              <boxGeometry args={[2.5, 0.05, 0.9]} />
              <meshStandardMaterial color="#B08D3C" metalness={0.5} roughness={0.45} />
            </mesh>
          </group>

          {/* Single shared key light for the welcome group, hung in front of and
              above the two greeters so faces and photo boards are lit from the
              visitor's side — never backlit into silhouette. Neutral-warm, not
              the old marigold spot, which would have tinted the skin in a real
              photo. Deliberately one light replacing one light: the welcome
              zone's real-light count is unchanged from before. */}
          <pointLight
            position={[0, 2.9, -0.9]}
            intensity={17}
            distance={9}
            decay={2}
            color="#FFEFDC"
          />

          {/* Greeting banner, hung above the aisle just past the two greeters.
              It used to sit at z +1.5 — i.e. behind the spawn point, where an
              arriving visitor never saw it. distanceFactor dropped from 8 to 3
              to match: at 3.7 m from the eye, 8 rendered it several times
              screen-width and clipped off the top of the viewport. */}
          {showWelcome && !isOverlayActive && (
            <Html position={[0, 3.2, -2.6]} center distanceFactor={3} zIndexRange={[1, 0]}>
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
