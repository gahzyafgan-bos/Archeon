import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The sprite each dust mote is drawn with.
 *
 * Without a `map`, `THREE.PointsMaterial` rasterises every point as a hard
 * square. At `size: 0.04` those squares are only a few pixels across, and with
 * additive blending over the dark opening of an archway they stop reading as
 * motes of dust and start reading as scattered white specks — which is exactly
 * how the glitch was reported: "titik putih ... kaya kotak kecil". The colours
 * here are a warm cream (0.95/0.88/0.72), but additive blending piles them
 * towards white against anything dark.
 *
 * A radial alpha falloff is the whole fix: the mote keeps its centre and fades
 * out before its own edge, so there is no square to see. Built once at module
 * scope and shared by every dust system in the museum — it is 64x64 and
 * identical everywhere, so there is no reason for each artifact to own one.
 */
const DUST_SPRITE = createDustSprite();

function createDustSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  // Opaque core, then a curve that is already almost gone by 60% of the
  // radius. A linear falloff still leaves a visible disc edge under additive
  // blending; this does not.
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.5)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface DustParticlesProps {
  count?: number;
  position?: [number, number, number];
  radius?: number;
  height?: number;
}

export function DustParticles({
  count = 80,
  position = [0, 3, 0],
  radius = 2,
  height = 4,
}: DustParticlesProps) {
  const meshRef = useRef<THREE.Points>(null);

  const { particles, geometry } = useMemo(() => {
    const tempParticles: { pos: THREE.Vector3; vel: THREE.Vector3; phase: number }[] = [];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = Math.random() * height;
      
      const particle = {
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05 + 0.02,
          (Math.random() - 0.5) * 0.05
        ),
        phase: Math.random() * Math.PI * 2,
      };
      tempParticles.push(particle);

      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3 + 0] = 0.95 * brightness;
      colors[i * 3 + 1] = 0.88 * brightness;
      colors[i * 3 + 2] = 0.72 * brightness;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Fixed by hand, and never recomputed. The points move every frame, so a
    // bounding volume derived once from their starting positions goes stale
    // immediately — and a stale one makes the frustum test wrong, which shows
    // up as the whole dust column blinking out when the visitor turns. This
    // sphere covers the entire volume the simulation can ever reach: the loop
    // rules below keep every particle inside `radius` horizontally and between
    // 0 and `height` vertically.
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, height / 2, 0),
      Math.hypot(radius, height / 2)
    );

    return { particles: tempParticles, geometry: geo };
  }, [count, radius, height]);

  // `geometry` is created here, so disposing it is this component's job. R3F
  // only auto-disposes objects it constructed itself, and the <primitive>
  // below hands it one we built.
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const positions = meshRef.current.geometry.attributes.position;

    particles.forEach((p, i) => {
      p.phase += delta;
      p.pos.x += p.vel.x * delta;
      p.pos.y += p.vel.y * delta;
      p.pos.z += p.vel.z * delta;

      // Add slight wobble
      p.pos.x += Math.sin(p.phase + i) * 0.002;
      p.pos.z += Math.cos(p.phase * 0.7 + i) * 0.002;

      // Loop particles back
      if (p.pos.y > height) p.pos.y = 0;
      if (p.pos.y < 0) p.pos.y = height;
      
      const dist = Math.sqrt(p.pos.x ** 2 + p.pos.z ** 2);
      if (dist > radius) {
        const angle = Math.atan2(p.pos.z, p.pos.x);
        p.pos.x = Math.cos(angle) * radius * 0.9;
        p.pos.z = Math.sin(angle) * radius * 0.9;
        p.vel.negate();
      }

      positions.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    });

    positions.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={meshRef}>
        {/* `<bufferGeometry attach="geometry" {...geometry} />` stood here.
            That spreads a BufferGeometry INSTANCE as if its fields were JSX
            props: R3F built a second, empty geometry and then copied `uuid`,
            `attributes`, `drawRange`, `boundingSphere` and the rest onto it
            one property at a time. Two live geometries claiming the same uuid,
            sharing attribute objects by reference, with the copy's own state
            assembled in whatever order the props happened to be applied.
            That is also the most plausible source of the intermittent
            `WebGL: INVALID_VALUE: bufferSubData: srcOffset + length too large`
            the audit recorded (P2-6) and could not localise — every frame,
            this is the one buffer in the app being re-uploaded.
            <primitive> passes the geometry itself, which is what was meant. */}
        <primitive object={geometry} attach="geometry" />
        <pointsMaterial
          // `map` is what turns each point from a hard square into a soft
          // mote — see DUST_SPRITE. Everything else is unchanged.
          map={DUST_SPRITE}
          size={0.04}
          vertexColors
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
