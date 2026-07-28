import type { RoomId } from "@/types/artifact";
import type { Greeter } from "@/types/greeter";

/**
 * The people who receive visitors in Hall 1's welcome zone.
 *
 * NOT artifacts, and deliberately not in artifacts.json — see the doc comment
 * on the Greeter type. Nothing here feeds the MiniMap, the visited-count, or
 * scripts/validate-artifacts.mjs.
 *
 * Layout (derived from the audit, not from a template):
 *   spawn        = (0, 6) facing -Z  (ROOM_CONFIGS["hall-1"].spawn)
 *   welcome zone = (0, 5.2), radius 3.5
 *
 * Both figures stand 2.95 m ahead of the spawn point and 1.5 m out to either
 * side of the entry axis, which puts them 3.30 m away (inside the 2.5-3.5 m
 * comfortable reading band), 26.9 deg off the initial view direction (well
 * inside a landscape phone's ~±54 deg horizontal FOV), and leaves 2.42 m of
 * clear floor between their bodies for people to walk through. The centre
 * axis itself stays empty so the sightline from spawn to the hall's
 * centerFocus — and past it to Garudeya and the zone heroes — is unbroken.
 *
 * rotationY makes each of them look straight back at the spawn point rather
 * than stand parallel to the wall: atan2(spawnX - x, spawnZ - z).
 */
export const GREETERS: Greeter[] = [
  {
    id: "greeter-1",
    roomId: "hall-1",
    name: "",
    role: "",
    caption: "",
    position: [-1.5, 0, 3.05],
    rotationY: 0.47,
    // Board on the aisle-facing side would pinch the walkway, so each board
    // sits on its person's outer side: [board][orang] .. lorong .. [orang][board].
    photoSide: -1,
    accentColor: "#C56A3A", // terracotta
  },
  {
    id: "greeter-2",
    roomId: "hall-1",
    name: "",
    role: "",
    caption: "",
    position: [1.5, 0, 3.05],
    rotationY: -0.47,
    photoSide: 1,
    accentColor: "#1F7A6E", // teal
  },
];

/** Capsule collider radius per greeter (metres). Small enough that the 2.42 m
 * corridor between them stays comfortably walkable, big enough that a visitor
 * can never walk through a person. Consumed by PlayerRig. */
export const GREETER_COLLIDER_RADIUS = 0.4;

export function getGreetersForRoom(roomId: RoomId): Greeter[] {
  return GREETERS.filter((g) => g.roomId === roomId);
}
