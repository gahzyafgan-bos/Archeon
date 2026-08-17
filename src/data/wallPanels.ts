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
  /** Outer frame width in metres. */
  width: number;
  /**
   * HEIGHT IS NOT DECLARED HERE — it is measured from the text.
   *
   * The panel used to carry a fixed `height`, and the text was cropped to it:
   * the museum's own history stopped mid-sentence at "…di Jalan Raya" and the
   * paragraph about the collection never appeared at all. Now the board grows
   * to whatever the naskah needs (see createHistoryPanelTexture) and these two
   * only bound it: `minHeight` keeps a short panel from looking mean, and
   * `maxHeight` is how much wall is actually free between the dado cap (1.0 m)
   * and `topY`. Exceeding maxHeight makes the board taller anyway and warns in
   * dev — it never shortens the naskah.
   */
  minHeight: number;
  maxHeight: number;
  /**
   * Room-relative position. `y` IS THE TOP EDGE of the frame, not its centre:
   * the boards have different heights now, and hanging them from a shared top
   * line is what keeps them reading as one composition. Only x/z are consumed
   * by RoomShell's wall-feature map.
   */
  getPosition: (bounds: RoomBounds) => [number, number, number];
  rotationY: number;
  variant: "primary" | "secondary";
  accentColor: string;
  groundColor: string;
  inkColor: string;
  /** Physical cap height of the title, metres. Defaults to 11 cm. */
  titleCapM?: number;
}

/** Frame margin on each side: printed board = frame size minus 2x this. */
export const HISTORY_PANEL_FRAME_MARGIN = 0.08;

/**
 * Shared top line for the welcome-zone pigoras, metres above the floor.
 *
 * 3.30 m sits clear of the frieze band (which starts at 5.39 m in a 6 m hall)
 * and leaves the taller board's bottom edge above the 1.0 m dado cap.
 */
const WELCOME_PANEL_TOP_Y = 3.3;

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
    // Widened from 2.8 m. The naskah is four paragraphs; at 2.8 m it wrapped
    // to 13 lines and the board had to grow past the dado cap to hold them.
    // A wider column is the cheaper axis — the south wall of the welcome zone
    // is 24 m long and carries nothing else.
    width: 3.2,
    minHeight: 1.6,
    // Top line 3.30 m, dado cap 1.0 m, plus a little air: 2.2 m of frame.
    maxHeight: 2.2,
    // x = -1.15 -> spans -2.75..0.45, leaving a 0.25 m reveal before the
    // secondary panel. z = 7.325 is the south wall face.
    getPosition: (bounds: RoomBounds) => [-1.15, WELCOME_PANEL_TOP_Y, bounds.maxZ - 0.175],
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
    // 1.35 m was too narrow for a 230-character paragraph: it wrapped to nine
    // lines of ~28 characters, which reads as a column of fragments and made
    // the secondary board taller than the primary one.
    width: 1.9,
    minHeight: 1.2,
    maxHeight: 2.2,
    // x = 1.65 -> spans 0.70..2.60. Hung from the same top line as the main
    // panel so the pair reads as one composition despite differing heights.
    getPosition: (bounds: RoomBounds) => [1.65, WELCOME_PANEL_TOP_Y, bounds.maxZ - 0.175],
    rotationY: Math.PI, // Facing North
    variant: "secondary",
    // Smaller than the museum panel's 11 cm on purpose: this is the subordinate
    // board, and its title is 27 characters against the other's 19.
    titleCapM: 0.07,
    accentColor: "#E8A020", // marigold
    groundColor: "#2E4A7D", // indigo
    inkColor: "#F2E9D8", // ivory
  },
];
