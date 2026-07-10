import { ReactNode, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { ArtifactMesh } from "@/components/artifacts/ArtifactMesh";
import { Dwarapala } from "@/components/artifacts/Dwarapala";
import { Pillar } from "@/components/architecture/Pillar";
import { HangingBanner } from "@/components/architecture/HangingBanner";
import { createBatikPattern } from "@/utils/batikPatterns";

interface RoomShellProps {
  room: RoomConfig;
  artifacts: Artifact[];
  children?: ReactNode;
}

export function RoomShell({ room, artifacts, children }: RoomShellProps) {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const wallHeight = 6;
  const { scene } = useThree();

  // Set up fog per room
  useMemo(() => {
    scene.fog = new THREE.FogExp2(room.wallColor, 0.04);
    return () => {
      scene.fog = null;
    };
  }, [room.wallColor, scene]);

  // State for Ruang1 light flicker
  const flickerTime = useRef(0);

  useFrame((_, delta) => {
    if (room.id === "room1") {
      flickerTime.current += delta;
    }
  });

  // Create batik textures
  const floorBorderTexture = useMemo(() => {
    switch (room.id) {
      case "lobby":
        return createBatikPattern("kawung", "#d9c8a8", "#a88040");
      case "room2":
        return createBatikPattern("parang", "#d9c0a0", "#c89030");
      case "room3":
        return createBatikPattern("artDeco", "#d0d0d0", "#607080");
      default:
        return null;
    }
  }, [room.id]);

  return (
    <group>
      {/* Floor with slight reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshPhysicalMaterial color={room.floorColor} roughness={0.6} clearcoat={0.3} clearcoatRoughness={0.2} />
      </mesh>
      {/* Floor border with batik pattern */}
      {floorBorderTexture && (
        <group>
          {/* Long side borders */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, minZ + 1.5]} receiveShadow>
            <planeGeometry args={[width - 2, 2]} />
            <meshStandardMaterial map={floorBorderTexture} roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, maxZ - 1.5]} receiveShadow>
            <planeGeometry args={[width - 2, 2]} />
            <meshStandardMaterial map={floorBorderTexture} roughness={0.8} />
          </mesh>
          {/* Short side borders */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[minX + 1.5, 0.01, centerZ]} receiveShadow>
            <planeGeometry args={[2, depth - 6]} />
            <meshStandardMaterial map={floorBorderTexture} roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[maxX - 1.5, 0.01, centerZ]} receiveShadow>
            <planeGeometry args={[2, depth - 6]} />
            <meshStandardMaterial map={floorBorderTexture} roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* Ceiling (custom per room) */}
      {(room.id === "lobby" || room.id === "room2") && (
        <group position={[0, wallHeight, 0]}>
          {/* Ceiling base */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial color="#3a3228" roughness={0.95} />
          </mesh>
          {/* Joglo/Candi style intersecting beams */}
          {Array.from({ length: Math.ceil(depth / 5) }).map((_, i) => {
            const zPos = minZ + 2.5 + i * 5;
            if (zPos > maxZ - 2) return null;
            return (
              <mesh
                key={`beam-x-${i}`}
                position={[centerX, -0.2, zPos]}
                castShadow
              >
                <boxGeometry args={[width - 2, 0.3, 0.3]} />
                <meshStandardMaterial color={room.id === "lobby" ? "#4a3828" : "#4a4438"} roughness={0.9} />
              </mesh>
            );
          })}
          {Array.from({ length: Math.ceil(width / 5) }).map((_, i) => {
            const xPos = minX + 2.5 + i * 5;
            if (xPos > maxX - 2) return null;
            return (
              <mesh
                key={`beam-z-${i}`}
                position={[xPos, -0.2, centerZ]}
                castShadow
              >
                <boxGeometry args={[0.3, 0.3, depth - 2]} />
                <meshStandardMaterial color={room.id === "lobby" ? "#4a3828" : "#4a4438"} roughness={0.9} />
              </mesh>
            );
          })}
          {/* Gold accent at intersections */}
          {Array.from({ length: Math.ceil(width / 5) }).flatMap((_, i) =>
            Array.from({ length: Math.ceil(depth / 5) }).map((_, j) => {
              const xPos = minX + 2.5 + i * 5;
              const zPos = minZ + 2.5 + j * 5;
              if (xPos > maxX - 2 || zPos > maxZ - 2) return null;
              return (
                <mesh
                  key={`accent-${i}-${j}`}
                  position={[xPos, -0.1, zPos]}
                  castShadow
                >
                  <boxGeometry args={[0.4, 0.1, 0.4]} />
                  <meshStandardMaterial color={room.accentColor} emissive={room.accentColor} emissiveIntensity={0.2} />
                </mesh>
              );
            })
          )}
        </group>
      )}
      {room.id === "room1" && (
        <group position={[0, wallHeight, 0]}>
          {/* Cave-like ceiling with stalactites */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial color="#3a3028" roughness={0.98} />
          </mesh>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh
              key={`stal-${i}`}
              position={[minX + 2 + Math.random() * (width - 4), -0.5 - Math.random() * 0.8, minZ + 2 + Math.random() * (depth - 4)]}
              castShadow
            >
              <coneGeometry args={[0.1 + Math.random() * 0.2, 0.5 + Math.random() * 1, 8]} />
              <meshStandardMaterial color="#4a4038" roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}
      {room.id === "room3" && (
        <group position={[0, wallHeight, 0]}>
          {/* Art deco grid ceiling */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
          </mesh>
          {Array.from({ length: Math.ceil(depth / 3) }).map((_, i) => {
            const zPos = minZ + 1.5 + i * 3;
            if (zPos > maxZ - 1.5) return null;
            return (
              <mesh
                key={`beam-x-${i}`}
                position={[centerX, -0.15, zPos]}
                castShadow
              >
                <boxGeometry args={[width - 1, 0.15, 0.15]} />
                <meshStandardMaterial color={room.accentColor} roughness={0.7} metalness={0.4} />
              </mesh>
            );
          })}
          {Array.from({ length: Math.ceil(width / 3) }).map((_, i) => {
            const xPos = minX + 1.5 + i * 3;
            if (xPos > maxX - 1.5) return null;
            return (
              <mesh
                key={`beam-z-${i}`}
                position={[xPos, -0.15, centerZ]}
                castShadow
              >
                <boxGeometry args={[0.15, 0.15, depth - 1]} />
                <meshStandardMaterial color={room.accentColor} roughness={0.7} metalness={0.4} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Walls with subtle color variation for non-flat look */}
      <mesh position={[centerX, wallHeight / 2, minZ]}>
        <boxGeometry args={[width, wallHeight, 0.3]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.88} />
      </mesh>
      <mesh position={[centerX, wallHeight / 2, maxZ]}>
        <boxGeometry args={[width, wallHeight, 0.3]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[minX, wallHeight / 2, centerZ]}>
        <boxGeometry args={[0.3, wallHeight, depth]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.92} />
      </mesh>
      <mesh position={[maxX, wallHeight / 2, centerZ]}>
        <boxGeometry args={[0.3, wallHeight, depth]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.9} />
      </mesh>

      {/* New Lighting System */}
      {/* Strong Ambient Base */}
      <ambientLight intensity={0.9} color="#e8d9c0" />
      {/* Warm Hemisphere */}
      <hemisphereLight args={["#f0d0a8", "#4a3a2a", 0.7]} />
      {/* Directional Light for Shadows */}
      <directionalLight
        position={[centerX + 8, wallHeight + 6, centerZ + 8]}
        intensity={0.5}
        color="#e0c890"
        castShadow
      />
      {/* Wall Sconces (Point Lights) */}
      {room.id === "room1" ? (
        <>
          <pointLight position={[centerX - 2, 4, minZ + 2]} intensity={0.35 + Math.sin(flickerTime.current * 2) * 0.03} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX + 2, 4, minZ + 2]} intensity={0.35 + Math.sin(flickerTime.current * 2.5 + 1) * 0.03} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX - 2, 4, maxZ - 2]} intensity={0.35 + Math.sin(flickerTime.current * 2.2 + 2) * 0.03} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX + 2, 4, maxZ - 2]} intensity={0.35 + Math.sin(flickerTime.current * 2.8 + 3) * 0.03} distance={12} decay={2} color="#e0a860" />
        </>
      ) : (
        <>
          <pointLight position={[centerX - 2, 4, minZ + 2]} intensity={0.35} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX + 2, 4, minZ + 2]} intensity={0.35} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX - 2, 4, maxZ - 2]} intensity={0.35} distance={12} decay={2} color="#e0a860" />
          <pointLight position={[centerX + 2, 4, maxZ - 2]} intensity={0.35} distance={12} decay={2} color="#e0a860" />
        </>
      )}

      {/* Room‑Specific Decor Elements */}
      {useMemo(() => {
        const elements: ReactNode[] = [];

        if (room.id === "room1") {
          // Prasejarah: gugusan bebatuan di sudut‑sudut + large stone pillars
          const stoneClusters = [
            { x: minX + 3, z: minZ + 3 },
            { x: maxX - 3, z: minZ + 3 },
            { x: minX + 3, z: maxZ - 3 },
            { x: maxX - 3, z: maxZ - 3 },
          ];
          stoneClusters.forEach((pos, i) => {
            elements.push(
              <group key={`stone-${i}`} position={[pos.x, 0, pos.z]}>
                <mesh castShadow receiveShadow position={[0, 0.5, 0]} rotation={[0.3, 0.5, 0]}>
                  <icosahedronGeometry args={[0.6, 1]} />
                  <meshStandardMaterial color="#5a4838" roughness={0.95} />
                </mesh>
                <mesh castShadow receiveShadow position={[0.4, 0.35, -0.2]} rotation={[-0.2, 1.2, 0.5]}>
                  <icosahedronGeometry args={[0.4, 1]} />
                  <meshStandardMaterial color="#6a5848" roughness={0.92} />
                </mesh>
              </group>
            );
          });
          // Prasejarah: large stalagmite-like stone pillars
          const rockPillarPositions = [
            { x: minX + 5, z: minZ + 8 },
            { x: maxX - 5, z: minZ + 8 },
            { x: minX + 5, z: maxZ - 8 },
            { x: maxX - 5, z: maxZ - 8 },
          ];
          rockPillarPositions.forEach((pos, i) => {
            elements.push(
              <group key={`rock-pillar-${i}`} position={[pos.x, 0, pos.z]}>
                <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
                  <cylinderGeometry args={[0.7, 1.2, 2.4, 8]} />
                  <meshStandardMaterial color="#4a4030" roughness={0.98} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, 2.8, 0]}>
                  <cylinderGeometry args={[0.5, 0.7, 1.6, 8]} />
                  <meshStandardMaterial color="#5a5040" roughness={0.96} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, 3.8, 0]}>
                  <coneGeometry args={[0.5, 0.8, 8]} />
                  <meshStandardMaterial color="#4a4030" roughness={0.98} />
                </mesh>
              </group>
            );
          });
        } else if (room.id === "lobby" || room.id === "room2" || room.id === "room3") {
          // Add pillars for non-prasejarah rooms
          const pillarStyle = room.id === "lobby" ? "joglo" : room.id === "room2" ? "candi" : "kolonial";
          const pillarHeight = 4.5;
          const pillarRadius = room.id === "room2" ? 0.45 : 0.35;
          const pillarPositions = [];
          const numPairs = 3;
          for (let i = 0; i < numPairs; i++) {
            const z = minZ + 4 + i * ((depth - 8) / (numPairs - 1));
            pillarPositions.push({ x: centerX - 5, z });
            pillarPositions.push({ x: centerX + 5, z });
          }
          pillarPositions.forEach((pos, i) => {
            elements.push(
              <Pillar
                key={`pillar-${i}`}
                height={pillarHeight}
                radius={pillarRadius}
                style={pillarStyle}
                accentColor={room.accentColor}
                position={[pos.x, 0, pos.z]}
              />
            );
          });

          // Add hanging banners between pillars
          if (room.id !== "room3") {
            const bannerStyle = room.id === "lobby" ? "kawung" : "parang";
            const bannerColor1 = room.id === "lobby" ? "#e8d8b8" : "#d8c098";
            const bannerColor2 = room.id === "lobby" ? "#a88040" : "#c88030";
            for (let i = 0; i < numPairs - 1; i++) {
              const z = minZ + 4 + i * ((depth - 8) / (numPairs - 1)) + ((depth - 8) / (numPairs - 1)) / 2;
              elements.push(
                <HangingBanner
                  key={`banner-${i}`}
                  width={3}
                  height={2.5}
                  style={bannerStyle}
                  color1={bannerColor1}
                  color2={bannerColor2}
                  position={[centerX, wallHeight - 0.5, z]}
                />
              );
            }
          }
        }

        if (room.id === "room2") {
          // God Rays / Light Shafts for Room 2
          const shaftPositions = [
            { x: centerX - 3, z: centerZ - 2 },
            { x: centerX + 3, z: centerZ - 2 },
            { x: centerX, z: centerZ + 3 },
          ];
          shaftPositions.forEach((pos, i) => {
            elements.push(
              <mesh key={`shaft-${i}`} position={[pos.x, 3, pos.z]} rotation={[0, Math.random() * Math.PI, 0]}>
                <coneGeometry args={[0.6, 6, 16, 1, true]} />
                <meshBasicMaterial color="#e6c76e" transparent opacity={0.08} side={THREE.DoubleSide} />
              </mesh>
            );
          });

          // Dwarapala di pintu masuk (jika ada pintu ke lobby)
          const lobbyDoor = room.doors.find(d => d.label.includes("Lobi"));
          if (lobbyDoor) {
            elements.push(
              <Dwarapala key="dwarapala-left" position={[lobbyDoor.position.x - 2, 0, lobbyDoor.position.z - 1]} rotation={0} />,
              <Dwarapala key="dwarapala-right" position={[lobbyDoor.position.x + 2, 0, lobbyDoor.position.z - 1]} rotation={Math.PI} />
            );
          }
        } else if (room.id === "room3") {
          // IPTEK: panel dinding transisi kayu + logam
          const wallPanels = [
            { x: minX + 0.5, z: centerZ },
            { x: maxX - 0.5, z: centerZ },
          ];
          wallPanels.forEach((pos, i) => {
            elements.push(
              <group key={`wall-panel-${i}`} position={[pos.x, 0, pos.z]}>
                {/* Bagian bawah: kayu */}
                <mesh position={[0, 1.5, 0]} rotation={[0, 0, 0]}>
                  <boxGeometry args={[0.1, 3, depth - 4]} />
                  <meshStandardMaterial color="#5a4838" roughness={0.85} />
                </mesh>
                {/* Bagian atas: logam */}
                <mesh position={[0, 4.5, 0]} rotation={[0, 0, 0]}>
                  <boxGeometry args={[0.1, 3, depth - 4]} />
                  <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.8} />
                </mesh>
              </group>
            );
          });
        }
        return elements;
      }, [room.id, minX, maxX, minZ, maxZ, centerX, centerZ, width, depth, room.accentColor])}

      {/* Doorway Markers (only collision box) */}
      {room.doors.map((door) => (
        <group key={door.label} position={[door.position.x, 0, door.position.z]}>
          <mesh position={[0, 1.6, 0]}>
            <boxGeometry args={[2, 3.2, 0.15]} />
            <meshStandardMaterial
              color={room.accentColor}
              emissive={room.accentColor}
              emissiveIntensity={0.25}
              transparent
              opacity={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Artifacts */}
      {artifacts.map((artifact) => (
        <ArtifactMesh key={artifact.id} artifact={artifact} accentColor={room.accentColor} />
      ))}

      {children}
    </group>
  );
}
