import { useEffect, useMemo } from "react";
import { RoomShell } from "./RoomShell";
import { Greeter } from "@/components/architecture/Greeter";
import { getGreetersForRoom } from "@/data/greeters";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { createSignPlateTexture } from "@/utils/panelTexture";
import { DEFAULT_CEILING_HEIGHT } from "@/utils/hallGeometry";

import { WelcomeHistoryPanels } from "@/components/architecture/WelcomeHistoryPanels";

/** Hanging cloth banner, in metres. A hall banner carries larger letters than a
 * zone post — it is read from the far end of the aisle, not from arm's length —
 * but it is still a fixed physical size at every distance. */
const BANNER_W = 2.8;
const BANNER_H = 0.74;
const BANNER_CENTER_Y = 3.5;
const BANNER_CAP_M = 0.13;
const CORD_X = 1.2;

function WelcomeBanner({ ceilingHeight, localZ }: { ceilingHeight: number; localZ: number }) {
  const texture = useMemo(
    () =>
      createSignPlateTexture({
        title: "SELAMAT DATANG",
        subtitle: "Museum Mpu Tantular · ikuti jalur di lantai menuju Koleksi Prasejarah & Galeri Hindu-Buddha",
        widthM: BANNER_W,
        heightM: BANNER_H,
        ground: "#2E4A7D",
        ink: "#F2E9D8",
        accent: "#B08D3C",
        titleCapM: BANNER_CAP_M,
      }),
    []
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const bannerTop = BANNER_CENTER_Y + BANNER_H / 2;
  const cordLength = Math.max(0.2, ceilingHeight - bannerTop);

  return (
    <group position={[0, 0, localZ]}>
      {/* Two cords running from the banner's top rail to the ceiling. The beam
          grid for this hall runs at x = -9.5/-4.5/0.5/5.5 and z = -5/0/5 (see
          hallGeometry), so neither cord passes through a beam on its way up —
          a cord that ends in mid-air or crosses structure is exactly what makes
          a hanging prop read as a bug. */}
      {[-CORD_X, CORD_X].map((x) => (
        <mesh key={x} position={[x, bannerTop + cordLength / 2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, cordLength, 6]} />
          <meshStandardMaterial color="#4A3A28" roughness={0.9} />
        </mesh>
      ))}
      {/* Top rail the cloth hangs from. */}
      <mesh position={[0, bannerTop + 0.03, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, BANNER_W + 0.18, 8]} />
        <meshStandardMaterial color="#7A5230" roughness={0.75} />
      </mesh>
      {/* Printed face toward the entrance (a plane's default normal is +Z, and
          the spawn point is at +Z of this banner), with a plain cloth back so
          the banner isn't an invisible hole when seen from the far side —
          rather than a double-sided material, which would show the lettering
          mirrored. */}
      <mesh position={[0, BANNER_CENTER_Y, 0.006]}>
        <planeGeometry args={[BANNER_W, BANNER_H]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
      <mesh position={[0, BANNER_CENTER_Y, 0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[BANNER_W, BANNER_H]} />
        <meshStandardMaterial color="#24395F" roughness={0.9} />
      </mesh>
    </group>
  );
}

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
              arriving visitor never saw it.

              It also used to be a drei <Html> panel that faded in on proximity
              and grew as you walked toward it. Both had to go: a DOM overlay is
              drawn once across the whole canvas, so in Mode VR it straddled the
              seam between the two eye viewports (see panelTexture.ts), and a
              banner that appears when you get close and swells as you approach
              is behaving like a tooltip, not like a piece of cloth hanging from
              a ceiling. It is now geometry at a fixed real-world size, present
              the whole time, carried by two visible cords. */}
          <WelcomeBanner ceilingHeight={hall.ceilingHeight ?? DEFAULT_CEILING_HEIGHT} localZ={-3.4} />
        </group>
      )}

      {/* Museum History Pigoras mounted on the South wall of the welcome zone.
          Rendered outside the welcomeZone group because their positions are in
          world space (derived from room bounds), not local to the zone centre. */}
      {welcomeZone && <WelcomeHistoryPanels bounds={hall.bounds} />}
    </RoomShell>
  );
}
