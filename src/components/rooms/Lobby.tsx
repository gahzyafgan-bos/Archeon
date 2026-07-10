import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { RoomShell } from "./RoomShell";
import { ROOM_CONFIGS } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";

const RECEPTION_POS = { x: 0, z: -8 };
const WELCOME_TRIGGER_RADIUS = 5;

export function Lobby({ artifacts }: { artifacts: Artifact[] }) {
  const room = ROOM_CONFIGS.lobby;
  const { camera } = useThree();
  const [showWelcome, setShowWelcome] = useState(false);

  useFrame(() => {
    const dx = camera.position.x - RECEPTION_POS.x;
    const dz = camera.position.z - RECEPTION_POS.z;
    const near = dx * dx + dz * dz < WELCOME_TRIGGER_RADIUS * WELCOME_TRIGGER_RADIUS;
    if (near !== showWelcome) setShowWelcome(near);
  });

  return (
    <RoomShell room={room} artifacts={artifacts}>
      {/* Gapura Candi Bentar at Room 1 entrance */}
      <group position={[0, 0, -13]}>
        {/* Left tower */}
        <group position={[-2.2, 0, 0]}>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1.5, 2, 1.2]} />
            <meshStandardMaterial color="#5a4838" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <boxGeometry args={[1.3, 1.6, 1.0]} />
            <meshStandardMaterial color="#655040" roughness={0.88} />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <boxGeometry args={[1.0, 1.2, 0.9]} />
            <meshStandardMaterial color="#5a4838" roughness={0.9} />
          </mesh>
          <mesh position={[0, 5.6, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.8, 0.5, 0.7]} />
            <meshStandardMaterial color="#655040" roughness={0.88} />
          </mesh>
        </group>
        {/* Right tower */}
        <group position={[2.2, 0, 0]}>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1.5, 2, 1.2]} />
            <meshStandardMaterial color="#5a4838" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <boxGeometry args={[1.3, 1.6, 1.0]} />
            <meshStandardMaterial color="#655040" roughness={0.88} />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <boxGeometry args={[1.0, 1.2, 0.9]} />
            <meshStandardMaterial color="#5a4838" roughness={0.9} />
          </mesh>
          <mesh position={[0, 5.6, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.8, 0.5, 0.7]} />
            <meshStandardMaterial color="#655040" roughness={0.88} />
          </mesh>
        </group>
      </group>

      {/* Kawung Floor Pattern near Reception Area */}
      {(() => {
        const kawungTiles: { x: number; z: number }[] = [];
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            if ((i + j) % 2 === 0) {
              kawungTiles.push({ x: i, z: j });
            }
          }
        }
        return (
          <group position={[RECEPTION_POS.x, 0.02, RECEPTION_POS.z]}>
            {kawungTiles.map((tile, i) => (
              <mesh
                key={i}
                position={[tile.x * 0.8, 0, tile.z * 0.8]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
              >
                <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
                <meshStandardMaterial color="#c9b898" roughness={0.85} />
              </mesh>
            ))}
          </group>
        );
      })()}

      {/* Wall Decor Panels */}
      <group position={[0, 3, -10]}>
        <mesh position={[-4, 0, 0]}>
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial color="#7a6858" roughness={0.9} />
        </mesh>
        <mesh position={[4, 0, 0]}>
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial color="#7a6858" roughness={0.9} />
        </mesh>
      </group>

      {/* Reception desk */}
      <group position={[RECEPTION_POS.x, 0, RECEPTION_POS.z]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 1, 0.9]} />
          <meshStandardMaterial color="#3a2818" roughness={0.75} />
        </mesh>
        {/* Redesigned Mannequin with Batik Colors */}
        <group position={[0, 1, -0.7]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
            <meshStandardMaterial color="#a05030" roughness={0.82} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color="#d9c0a8" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.72, 0]} castShadow>
            <coneGeometry args={[0.24, 0.22, 12]} />
            <meshStandardMaterial color="#2a2520" roughness={0.9} />
          </mesh>
          {/* Selendang (sash) */}
          <mesh position={[-0.0, 1.2, 0.1]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.5, 0.05, 0.8]} />
            <meshStandardMaterial color="#c08050" roughness={0.75} />
          </mesh>
        </group>
        <spotLight
          position={[0, 4.5, -0.5]}
          angle={0.5}
          penumbra={0.6}
          intensity={30}
          color="#e0c070"
        />
      </group>

      {showWelcome && (
        <Html position={[RECEPTION_POS.x, 2.6, RECEPTION_POS.z + 1.5]} center distanceFactor={8}>
          <div className="glass-panel rounded-lg px-5 py-3 text-center animate-fade-in whitespace-nowrap pointer-events-none">
            <p className="font-display text-museum-bone text-lg tracking-wide">
              Selamat Datang di Museum Mpu Tantular Virtual
            </p>
            <p className="text-museum-mist text-xs mt-1">
              Ikuti lorong di depan Anda menuju Ruang 1 — Koleksi Prasejarah
            </p>
          </div>
        </Html>
      )}
    </RoomShell>
  );
}
