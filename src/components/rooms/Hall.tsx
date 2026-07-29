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
          {/* The "INFORMASI" counter used to stand here, at local (-3.4, 0.2):
              a 2.4 x 1.0 x 0.8 m box in #4a3020 with a brass top lip and an
              engraved plate on its front.

              Removed rather than rescaled. Its dimensions were actually right
              (1.05 m standing height, 2.4 m long — real reception desks are
              1.05-1.10 x 1.8-2.4 m); what was wrong was everything else:

               1. It did nothing. A counter is useful in a physical museum
                  because someone stands behind it. Here there was no attendant,
                  no click handler, no raycast entry — it promised "informasi"
                  and never delivered any, which is the whole reason it read as
                  useless.
               2. Its jobs were already taken. The onboarding panel, the two
                  greeters flanking this aisle and the MiniMap all answer
                  "where am I and what is this", and they do it better.
               3. It had no collider — PlayerRig only collides with artifacts,
                  greeters and the room bounds — so a solid-looking desk was
                  something you walked straight through.
               4. Near-black on a near-white floor made it the highest-contrast
                  object in the arrival view. The first thing a visitor saw was
                  an empty brown box rather than the two people greeting them.

              Nothing replaces it. The floor space is the point: it is what lets
              the greeters and the vista down the aisle read. */}

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
