import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { RoomBounds } from "@/data/roomConfig";
import { WELCOME_HISTORY_PANELS, type HistoryWallPanelData } from "@/data/wallPanels";
import { createHistoryPanelTexture } from "@/utils/panelTexture";
import { WALL_FURNITURE_MAT } from "@/components/architecture/InterpretivePanel";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";

function SingleHistoryPanel({
  panelData,
  bounds,
  maxAnisotropy,
}: {
  panelData: HistoryWallPanelData;
  bounds: RoomBounds;
  maxAnisotropy: number;
}) {
  const graphicsPreset = useGraphicsPreset();
  const position = useMemo(() => panelData.getPosition(bounds), [panelData, bounds]);

  const texture = useMemo(
    () =>
      createHistoryPanelTexture({
        title: panelData.title,
        subtitle: panelData.subtitle,
        body: panelData.body,
        widthM: panelData.width,
        heightM: panelData.height,
        accent: panelData.accentColor,
        ground: panelData.groundColor,
        ink: panelData.inkColor,
        maxAnisotropy,
      }),
    [panelData, maxAnisotropy]
  );

  useEffect(() => () => texture.dispose(), [texture]);

  const frameDepth = 0.05;
  const boardWidth = panelData.width - 0.16;
  const boardHeight = panelData.height - 0.16;

  // Overhead spotlight position: 1.1m above panel, slightly in front
  const lightPosY = position[1] + panelData.height / 2 + 0.45;
  const lightPosZ = position[2] - 0.45; // in front of the wall (+Z facing into room)

  return (
    <group position={position} rotation={[0, panelData.rotationY, 0]}>
      {/* Outer warm wood frame profile (gives physical 3D depth to the wall pigora) */}
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <boxGeometry args={[panelData.width, panelData.height, frameDepth]} />
        <primitive object={WALL_FURNITURE_MAT.wood} attach="material" />
      </mesh>

      {/* Brass reveal lip between frame and face board */}
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[panelData.width - 0.08, panelData.height - 0.08, 0.01]} />
        <primitive object={WALL_FURNITURE_MAT.brass} attach="material" />
      </mesh>

      {/* Printed panel face */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[boardWidth, boardHeight]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.7}
          // On low graphics preset where accent lights are off, boost emissive slightly so panel stays readable
          emissive={graphicsPreset.accentLightCount > 0 ? "#000000" : "#2A2A2A"}
        />
      </mesh>

      {/* Warm dedicated spotlight per pigora panel (High/Medium graphics preset) */}
      {graphicsPreset.accentLightCount > 0 && (
        <spotLight
          position={[0, lightPosY - position[1], -(lightPosZ - position[2])]}
          intensity={14}
          angle={0.65}
          penumbra={0.5}
          decay={2}
          distance={4.5}
          color="#FFEFDC"
        />
      )}
    </group>
  );
}

/**
 * Renders the Museum History Pigoras on the South wall of Hall 1's Welcome Zone.
 * Data-driven from `src/data/wallPanels.ts`, fully responsive to room bounds.
 */
export function WelcomeHistoryPanels({ bounds }: { bounds: RoomBounds }) {
  const { gl } = useThree();
  const maxAnisotropy = useMemo(() => {
    try {
      return gl.capabilities?.getMaxAnisotropy?.() ?? 8;
    } catch {
      return 8;
    }
  }, [gl]);

  return (
    <group key="welcome-history-pigoras">
      {WELCOME_HISTORY_PANELS.map((panel) => (
        <SingleHistoryPanel
          key={panel.id}
          panelData={panel}
          bounds={bounds}
          maxAnisotropy={maxAnisotropy}
        />
      ))}
    </group>
  );
}
