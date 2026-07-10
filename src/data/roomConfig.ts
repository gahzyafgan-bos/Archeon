import type { RoomId } from "@/store/useMuseumStore";

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Door {
  position: { x: number; z: number };
  radius: number;
  targetRoom: RoomId;
  targetSpawn: { x: number; z: number; facingY: number };
  label: string;
}

export interface RoomConfig {
  id: RoomId;
  name: string;
  bounds: RoomBounds;
  spawn: { x: number; z: number; facingY: number };
  doors: Door[];
  wallColor: string;
  floorColor: string;
  accentColor: string;
}

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  lobby: {
    id: "lobby",
    name: "Lobi Utama",
    bounds: { minX: -14, maxX: 14, minZ: -14, maxZ: 14 },
    spawn: { x: 0, z: 10, facingY: 0 },
    wallColor: "#6b5744",
    floorColor: "#4a3826",
    accentColor: "#d4af6a",
    doors: [
      {
        position: { x: 0, z: -13.5 },
        radius: 2.2,
        targetRoom: "room1",
        targetSpawn: { x: 0, z: 14, facingY: 0 },
        label: "Ruang 1 — Koleksi Prasejarah",
      },
    ],
  },
  room1: {
    id: "room1",
    name: "Ruang 1 — Koleksi Prasejarah",
    bounds: { minX: -8, maxX: 8, minZ: -16, maxZ: 16 },
    spawn: { x: 0, z: 14, facingY: 0 },
    wallColor: "#6b4f3a",
    floorColor: "#5c4632",
    accentColor: "#c17a4a",
    doors: [
      {
        position: { x: 0, z: 15.5 },
        radius: 2.2,
        targetRoom: "lobby",
        targetSpawn: { x: 0, z: -10, facingY: Math.PI },
        label: "Kembali ke Lobi",
      },
      {
        position: { x: 0, z: -15.5 },
        radius: 2.2,
        targetRoom: "room2",
        targetSpawn: { x: 0, z: 14, facingY: 0 },
        label: "Ruang 2 — Galeri Hindu-Buddha",
      },
    ],
  },
  room2: {
    id: "room2",
    name: "Ruang 2 — Galeri Hindu-Buddha",
    bounds: { minX: -10, maxX: 10, minZ: -16, maxZ: 16 },
    spawn: { x: 0, z: 14, facingY: 0 },
    wallColor: "#584c42",
    floorColor: "#4a3f36",
    accentColor: "#e0b868",
    doors: [
      {
        position: { x: 0, z: 15.5 },
        radius: 2.2,
        targetRoom: "room1",
        targetSpawn: { x: 0, z: -14, facingY: Math.PI },
        label: "Kembali ke Ruang 1",
      },
      {
        position: { x: 0, z: -15.5 },
        radius: 2.2,
        targetRoom: "room3",
        targetSpawn: { x: 0, z: 14, facingY: 0 },
        label: "Ruang 3 — Transisi ke IPTEK",
      },
    ],
  },
  room3: {
    id: "room3",
    name: "Ruang 3 — Galeri Transisi ke IPTEK",
    bounds: { minX: -8, maxX: 8, minZ: -16, maxZ: 16 },
    spawn: { x: 0, z: 14, facingY: 0 },
    wallColor: "#564a3e",
    floorColor: "#4a3e34",
    accentColor: "#7fa8a3",
    doors: [
      {
        position: { x: 0, z: 15.5 },
        radius: 2.2,
        targetRoom: "room2",
        targetSpawn: { x: 0, z: -14, facingY: Math.PI },
        label: "Kembali ke Ruang 2",
      },
    ],
  },
};
