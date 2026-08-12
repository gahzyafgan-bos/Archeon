import { APP_NAME, TEAM_NAME } from "@/constants/credits";
import type { RoomId, ZoneId } from "@/types/artifact";
import type { RoomBounds } from "@/data/roomConfig";

export interface HistoryWallPanelData {
  id: string;
  roomId: RoomId;
  zoneId: ZoneId;
  title: string;
  subtitle?: string;
  body: string[];
  /** Sized in metres for 3D world geometry */
  width: number;
  height: number;
  /** Function calculating position relative to room bounds to prevent orphan positions on hall resize */
  getPosition: (bounds: RoomBounds) => [number, number, number];
  rotationY: number;
  variant: "primary" | "secondary";
  accentColor: string;
  groundColor: string;
  inkColor: string;
}

/**
  * History wall panels displayed in the welcome zone of Hall 1.
  *
  * NOTE: These are architectural interpretive wall panels and NOT exhibits/artifacts.
  * They MUST NOT be included in artifacts.json, MiniMap, visited counts, or artifact validation scripts.
  */
export const WELCOME_HISTORY_PANELS: HistoryWallPanelData[] = [
  {
    id: "welcome-history-main",
    roomId: "hall-1",
    zoneId: "welcome",
    title: "MUSEUM MPU TANTULAR",
    subtitle: "Museum Negeri Provinsi Jawa Timur",
    body: [
      "Cikal bakal Museum Mpu Tantular berawal dari lembaga kebudayaan Stedelijk Historisch Museum Soerabaia, yang didirikan oleh Godfried Hariowald von Faber pada tahun 1933 dan diresmikan pada 25 Juli 1937.",
      "Setelah beberapa kali berpindah lokasi di Surabaya, museum ini secara resmi berstatus Museum Negeri pada tahun 1974 dan diberi nama Museum Negeri Jawa Timur \"Mpu Tantular\", untuk menghormati Mpu Tantular, pujangga era Kerajaan Majapahit yang menulis Kakawin Sutasoma — karya yang menjadi sumber semboyan nasional \"Bhinneka Tunggal Ika\".",
      "Pada 14 Mei 2004, museum menempati lokasinya yang sekarang di Jalan Raya Buduran, Sidoarjo, di atas lahan seluas lebih dari tiga hektare.",
      "Koleksi museum mencakup benda arkeologi, arca dari masa Hindu-Buddha, fosil dan peninggalan masa prasejarah, benda etnografi, numismatik, hingga koleksi teknologi dari masa kolonial.",
    ],
    width: 2.8,
    height: 1.65,
    // Centered at x = -0.80, y = 2.05 (above 1.0m dado cap line), z = 7.325
    getPosition: (bounds: RoomBounds) => [-0.8, 2.05, bounds.maxZ - 0.175],
    rotationY: Math.PI, // Facing North
    variant: "primary",
    accentColor: "#B08D3C", // brass
    groundColor: "#2E4A7D", // indigo
    inkColor: "#F2E9D8", // ivory
  },
  {
    id: "welcome-history-virtual",
    roomId: "hall-1",
    zoneId: "welcome",
    title: APP_NAME.toUpperCase(),
    subtitle: "Pengalaman Virtual Interaktif",
    body: [
      "Ruang pameran ini adalah versi tiga dimensi yang dapat dijelajahi langsung dari peramban, menghadirkan sebagian koleksi Museum Mpu Tantular secara virtual bagi siapa saja yang belum sempat berkunjung langsung.",
      `Dikembangkan oleh ${TEAM_NAME}.`,
    ],
    width: 1.35,
    height: 1.15,
    // Centered at x = 1.475, y = 2.05 (aligned vertically with main panel), z = 7.325. 0.3m gap from main panel
    getPosition: (bounds: RoomBounds) => [1.475, 2.05, bounds.maxZ - 0.175],
    rotationY: Math.PI, // Facing North
    variant: "secondary",
    accentColor: "#E8A020", // marigold
    groundColor: "#2E4A7D", // indigo
    inkColor: "#F2E9D8", // ivory
  },
];
