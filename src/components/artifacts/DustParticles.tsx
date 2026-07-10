import { useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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
  const { viewport } = useThree();

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

    return { particles: tempParticles, geometry: geo };
  }, [count, radius, height]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const positions = meshRef.current.geometry.attributes.position;

    particles.forEach((p, i) => {
      p.phase += delta;
      p.pos.add(p.vel.clone().multiplyScalar(delta));
      
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
        <bufferGeometry attach="geometry" {...geometry} />
        <pointsMaterial
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
