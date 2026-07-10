import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createBatikPattern } from "@/utils/batikPatterns";

type BannerStyle = "kawung" | "parang" | "gajahOling" | "artDeco";

interface HangingBannerProps {
  width: number;
  height: number;
  style: BannerStyle;
  color1: string;
  color2: string;
  position: [number, number, number];
  rotationY?: number;
}

export function HangingBanner({
  width,
  height,
  style,
  color1,
  color2,
  position,
  rotationY = 0,
}: HangingBannerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(Math.random() * 100); // Randomize start time

  const texture = useMemo(() => {
    return createBatikPattern(style, color1, color2, 256);
  }, [style, color1, color2]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.9,
      transparent: true,
      opacity: 0.9,
    });
  }, [texture]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current) {
      // Subtle swaying animation
      const swayX = Math.sin(timeRef.current * 1.2) * 0.02;
      const swayZ = Math.cos(timeRef.current * 1.0) * 0.015;
      meshRef.current.rotation.x = swayX;
      meshRef.current.position.z = position[2] + swayZ;
    }
  });

  return (
    <group position={position}>
      {/* Hanging rod */}
      <mesh position={[0, height / 2 + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, width + 0.4, 8]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
      </mesh>
      {/* Banner */}
      <mesh ref={meshRef} rotation={[0, rotationY, 0]} castShadow>
        <planeGeometry args={[width, height, 8, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}
