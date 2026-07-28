import { useMemo } from "react";
import * as THREE from "three";
import type { Greeter as GreeterData } from "@/types/greeter";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { getPhotoFallbackTexture, useGreeterLabelTexture, useGreeterPhoto } from "@/utils/greeterPhoto";

/**
 * Geometry and the non-personal materials are created once at module scope and
 * attached by reference, so the second greeter costs no extra buffers or
 * shader programs — only the accent-coloured garment differs per person. The
 * whole figure is primitives; a GLB of a human at this fidelity would cost
 * more to download than it would add.
 *
 * Attached via <primitive attach>, which R3F treats as a borrowed object and
 * never disposes, unlike a geometry it builds itself from `args`.
 */
const GEO = {
  lowerBody: new THREE.CylinderGeometry(0.19, 0.22, 0.72, 12),
  torso: new THREE.CapsuleGeometry(0.19, 0.36, 4, 12),
  arm: new THREE.CapsuleGeometry(0.052, 0.4, 3, 8),
  neck: new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8),
  head: new THREE.SphereGeometry(0.115, 16, 14),
  // Top half only, nudged back and up: a cap that reaches any lower than the
  // equator crosses the face and reads as a mask pulled over the eyes.
  hair: new THREE.SphereGeometry(0.121, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
  /** Two dots are the cheapest thing that makes a primitive figure read as a
   * person who is looking at you rather than a faceless mannequin — and they
   * make the ±27 deg turn toward the spawn point legible at a glance. */
  eye: new THREE.SphereGeometry(0.016, 8, 6),
  post: new THREE.CylinderGeometry(0.045, 0.055, 0.95, 10),
  boardBack: new THREE.BoxGeometry(0.6, 0.94, 0.05),
  frame: new THREE.BoxGeometry(0.51, 0.66, 0.02),
  photo: new THREE.PlaneGeometry(0.45, 0.6),
  plate: new THREE.PlaneGeometry(0.52, 0.18),
};

const MAT = {
  skin: new THREE.MeshStandardMaterial({ color: "#C79B70", roughness: 0.88 }),
  hair: new THREE.MeshStandardMaterial({ color: "#241C16", roughness: 0.92 }),
  /** Batik sarong, warm wood from the palette — shared, both wear one. */
  sarong: new THREE.MeshStandardMaterial({ color: "#7A5230", roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: "#B08D3C", metalness: 0.55, roughness: 0.4 }),
  board: new THREE.MeshStandardMaterial({ color: "#2E4A7D", roughness: 0.75 }),
};

/** Board sits this far out along the figure's local X, on its outer side. */
const BOARD_OFFSET = 0.72;
/** Board centre height; puts the photo's own centre at 1.50 m — visitor eye level. */
const BOARD_HEIGHT = 1.38;

export function Greeter({ greeter }: { greeter: GreeterData }) {
  const graphicsPreset = useGraphicsPreset();
  const photo = useGreeterPhoto(greeter);
  const label = useGreeterLabelTexture(greeter);

  const garmentMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: greeter.accentColor, roughness: 0.8 }),
    [greeter.accentColor]
  );

  // The photo alone is unlit: the hall's warm accent lighting must not turn a
  // real person's skin marigold. The brass frame around it stays a lit
  // standard material, which is what keeps the board sitting inside the room
  // instead of floating over it.
  const photoMaterial = useMemo(() => {
    if (!photo) return null;
    return new THREE.MeshBasicMaterial({ map: photo });
  }, [photo]);

  const labelMaterial = useMemo(() => {
    if (!label) return null;
    return new THREE.MeshBasicMaterial({ map: label, transparent: true });
  }, [label]);

  const side = greeter.photoSide;
  const castShadow = graphicsPreset.shadowsEnabled;

  return (
    <group position={greeter.position} rotation={[0, greeter.rotationY, 0]}>
      {/* --- The person (faces local +Z, i.e. toward the visitor) --- */}
      <mesh position={[0, 0.36, 0]} castShadow={castShadow} receiveShadow>
        <primitive object={GEO.lowerBody} attach="geometry" />
        <primitive object={MAT.sarong} attach="material" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow={castShadow}>
        <primitive object={GEO.torso} attach="geometry" />
        <primitive object={garmentMaterial} attach="material" />
      </mesh>
      {/* Arms hang against the body — pushed any further out they stop reading
          as arms and start reading as stubby wings. */}
      <mesh position={[-0.205, 1.03, 0]} rotation={[0, 0, 0.05]} castShadow={castShadow}>
        <primitive object={GEO.arm} attach="geometry" />
        <primitive object={garmentMaterial} attach="material" />
      </mesh>
      <mesh position={[0.205, 1.03, 0]} rotation={[0, 0, -0.05]} castShadow={castShadow}>
        <primitive object={GEO.arm} attach="geometry" />
        <primitive object={garmentMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 1.44, 0]}>
        <primitive object={GEO.neck} attach="geometry" />
        <primitive object={MAT.skin} attach="material" />
      </mesh>
      <mesh position={[0, 1.565, 0]} castShadow={castShadow}>
        <primitive object={GEO.head} attach="geometry" />
        <primitive object={MAT.skin} attach="material" />
      </mesh>
      <mesh position={[0, 1.572, -0.018]}>
        <primitive object={GEO.hair} attach="geometry" />
        <primitive object={MAT.hair} attach="material" />
      </mesh>
      <mesh position={[-0.042, 1.575, 0.104]}>
        <primitive object={GEO.eye} attach="geometry" />
        <primitive object={MAT.hair} attach="material" />
      </mesh>
      <mesh position={[0.042, 1.575, 0.104]}>
        <primitive object={GEO.eye} attach="geometry" />
        <primitive object={MAT.hair} attach="material" />
      </mesh>

      {/* --- Framed photo board on the outer side, rotated with the figure so
              it already faces the arriving visitor (~12 deg off their line of
              sight from the spawn point). --- */}
      <group position={[side * BOARD_OFFSET, 0, 0.02]}>
        <mesh position={[0, 0.475, 0]} castShadow={castShadow} receiveShadow>
          <primitive object={GEO.post} attach="geometry" />
          <primitive object={MAT.brass} attach="material" />
        </mesh>

        <group position={[0, BOARD_HEIGHT, 0]}>
          <mesh castShadow={castShadow} receiveShadow>
            <primitive object={GEO.boardBack} attach="geometry" />
            <primitive object={MAT.board} attach="material" />
          </mesh>

          {/* Brass mat behind the photo — its 3 cm reveal is the frame. */}
          <mesh position={[0, 0.12, 0.028]}>
            <primitive object={GEO.frame} attach="geometry" />
            <primitive object={MAT.brass} attach="material" />
          </mesh>

          <mesh position={[0, 0.12, 0.041]}>
            <primitive object={GEO.photo} attach="geometry" />
            {photoMaterial ? (
              <primitive object={photoMaterial} attach="material" />
            ) : (
              <meshStandardMaterial
                attach="material"
                map={getPhotoFallbackTexture()}
                roughness={0.9}
              />
            )}
          </mesh>

          {/* Name/role plate — omitted entirely while the museum hasn't
              supplied the text, rather than rendered as an empty strip. */}
          {labelMaterial && (
            <mesh position={[0, -0.3, 0.028]}>
              <primitive object={GEO.plate} attach="geometry" />
              <primitive object={labelMaterial} attach="material" />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
