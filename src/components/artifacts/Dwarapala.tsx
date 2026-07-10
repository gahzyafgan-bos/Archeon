import * as THREE from "three";

interface DwarapalaProps {
  position: [number, number, number];
  rotation?: number; // y rotation
}

/**
 * Komponen Arca Dwarapala (penjaga raksasa)
 * Dibuat dari primitif geometri untuk performa ringkas
 */
export function Dwarapala({ position, rotation = 0 }: DwarapalaProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Base/Pedestal */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.7, 0.6, 12]} />
        <meshStandardMaterial color="#2a241a" roughness={0.9} />
      </mesh>

      {/* Torso (badan) */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.35, 1.2, 16]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>

      {/* Kepala */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.4, 20, 20]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>

      {/* Tangan kanan (memegang gada) */}
      <mesh position={[0.45, 1.5, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>

      {/* Gada di tangan kanan */}
      <mesh position={[0.75, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
        <meshStandardMaterial color="#3a332a" roughness={0.8} />
      </mesh>
      <mesh position={[0.75, 2.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#3a332a" roughness={0.8} />
      </mesh>

      {/* Tangan kiri (memegang gada) */}
      <mesh position={[-0.45, 1.5, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>

      {/* Gada di tangan kiri */}
      <mesh position={[-0.75, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.5, 8]} />
        <meshStandardMaterial color="#3a332a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.75, 2.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#3a332a" roughness={0.8} />
      </mesh>

      {/* Kaki (bersila) */}
      <mesh position={[0.3, 0.6, 0.25]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>
      <mesh position={[-0.3, 0.6, 0.25]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
        <meshStandardMaterial color="#4a453a" roughness={0.85} />
      </mesh>
    </group>
  );
}
