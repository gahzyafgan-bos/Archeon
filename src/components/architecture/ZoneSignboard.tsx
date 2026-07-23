import { Html } from "@react-three/drei";
import type { ZoneConfig } from "@/data/roomConfig";
import { useIsOverlayActive } from "@/hooks/useIsOverlayActive";

/**
 * Standing signboard at a zone's entrance (spec section 8.2) — a DOM label
 * anchored in 3D space via drei's <Html>, same technique already used for
 * the welcome greeting in Hall.tsx. Cheaper than a real text mesh (no font
 * loading) and reads crisply at any zoom level.
 */
export function ZoneSignboard({ zone }: { zone: ZoneConfig }) {
  const isOverlayActive = useIsOverlayActive();

  if (zone.id === "welcome") return null; // spawn point itself, a sign here is redundant

  // Post planted near the zone's edge closest to the walkway (the +Z side,
  // toward the welcome zone / hall entrance, for every populated zone in this layout).
  const postX = zone.center.x;
  const postZ = zone.center.z + zone.radius * 0.75;

  return (
    <group position={[postX, 0, postZ]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.2, 8]} />
        <meshStandardMaterial color="#7A5230" roughness={0.8} />
      </mesh>
      {/* Hidden while any full-screen overlay (Settings, InfoPanel, Onboarding,
          loading) is up — drei's Html defaults to a very high z-index so it can
          sit above the canvas, which also lets it escape the overlay's own
          stacking context and render on top of it. zIndexRange keeps it capped
          well under the app's own UI chrome (z-20+) as a second line of defense. */}
      {!isOverlayActive && (
        <Html position={[0, 2.3, 0]} center distanceFactor={10} occlude={false} zIndexRange={[1, 0]}>
          <div
            className="rounded-full px-4 py-1.5 text-center whitespace-nowrap pointer-events-none"
            style={{
              background: "rgba(30, 24, 16, 0.72)",
              border: `1px solid ${zone.accent}`,
              color: "#F2E9D8",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {zone.label}
          </div>
        </Html>
      )}
    </group>
  );
}
