import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";

/** Batik Modern palette — panel ground, frame, and text. */
const INDIGO = "#2E4A7D";
const BRASS = "#B08D3C";
const IVORY = "#F2E9D8";
const SAND = "#E4D5B7";

/** Metres in front of the viewer. Closer than ~1m and the eyes have to cross
 * uncomfortably to fuse the two images; further than ~2m and the text shrinks
 * past legibility on a half-width eye viewport. */
const PANEL_DISTANCE = 1.45;
const PANEL_WIDTH = 1.05;
const PANEL_HEIGHT = 0.62;
const PANEL_EYE_DROP = 0.12; // sit slightly below the horizon, like a lectern

/**
 * Trims the full description down to something readable inside a headset.
 * Long-form text belongs to the flat-screen panel, which can scroll; here the
 * visitor is standing in front of the actual object and only needs enough to
 * know what they're looking at.
 */
function shortDescription(full: string, maxSentences = 2, maxChars = 240): string {
  const sentences = full.replace(/\s+/g, " ").trim().split(/(?<=\.)\s+/);
  let out = "";
  for (const sentence of sentences.slice(0, maxSentences)) {
    if (out.length + sentence.length > maxChars) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  return out || full.slice(0, maxChars);
}

/**
 * The artifact information panel used while VR mode is active — a real object
 * in the scene rather than a DOM overlay.
 *
 * That choice is the whole point. A DOM panel sits on top of the canvas, which
 * in stereo mode means it is drawn once, across the seam between two eye
 * viewports, outside the barrel distortion and at no particular depth. Nothing
 * about it survives the trip through a Cardboard lens. Geometry in the scene,
 * by contrast, is rendered twice by the same stereo camera that draws
 * everything else, so it lands in both eyes at matching height, with the same
 * distortion and a depth the eyes can actually converge on — for free.
 *
 * The panel's world position is captured once, when it opens, and never
 * follows the head afterwards. A panel welded to head motion is one of the
 * more reliable ways to make someone ill; leaving it parked in space lets the
 * visitor look away from it and back at the object.
 */
export function VRInfoPanel() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const placed = useRef(false);

  const isOpen = isVRMode && !!focusedArtifact;

  useEffect(() => {
    // Re-place on the next frame each time the panel opens (or the artifact
    // changes), so it appears in front of wherever the visitor is now.
    placed.current = false;
  }, [focusedArtifact, isVRMode]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !isOpen || placed.current) return;

    // Park the panel a fixed distance along the direction the viewer is facing,
    // flattened to the horizontal plane so it never ends up above or below them
    // no matter how their head was tilted at the moment of opening.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    group.position
      .copy(camera.position)
      .addScaledVector(forward, PANEL_DISTANCE)
      .setY(camera.position.y - PANEL_EYE_DROP);
    group.lookAt(camera.position.x, group.position.y, camera.position.z);
    placed.current = true;
  });

  const body = useMemo(
    () => (focusedArtifact ? shortDescription(focusedArtifact.deskripsi) : ""),
    [focusedArtifact]
  );

  if (!isOpen || !focusedArtifact) return null;

  return (
    <group ref={groupRef}>
      {/* Ground. Opaque rather than translucent: transparent panels stack
          overdraw and, worse, let the scene behind bleed through the text at
          exactly the moment it needs contrast most. */}
      <mesh>
        <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
        <meshBasicMaterial color={INDIGO} toneMapped={false} />
      </mesh>
      {/* Brass frame — one slightly larger plane behind, no extra transparency. */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[PANEL_WIDTH + 0.02, PANEL_HEIGHT + 0.02]} />
        <meshBasicMaterial color={BRASS} toneMapped={false} />
      </mesh>

      <Text
        position={[-PANEL_WIDTH / 2 + 0.06, PANEL_HEIGHT / 2 - 0.09, 0.001]}
        anchorX="left"
        anchorY="top"
        // ~0.055m tall at 1.45m ≈ 2.2° of arc — comfortably above the ~2%
        // of viewport height that stays legible on a half-width eye view.
        fontSize={0.055}
        maxWidth={PANEL_WIDTH - 0.12}
        lineHeight={1.15}
        color={IVORY}
        outlineWidth={0.002}
        outlineColor="#000000"
      >
        {focusedArtifact.nama}
      </Text>

      <Text
        position={[-PANEL_WIDTH / 2 + 0.06, PANEL_HEIGHT / 2 - 0.2, 0.001]}
        anchorX="left"
        anchorY="top"
        fontSize={0.032}
        maxWidth={PANEL_WIDTH - 0.12}
        lineHeight={1.35}
        color={SAND}
      >
        {body}
      </Text>

      <Text
        position={[0, -PANEL_HEIGHT / 2 + 0.05, 0.001]}
        anchorX="center"
        anchorY="bottom"
        fontSize={0.026}
        color={BRASS}
      >
        Tombol B pada gamepad untuk kembali menjelajah
      </Text>
    </group>
  );
}
