import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";

/** Batik Modern palette — panel ground, frame, and text. */
const INDIGO = "#2E4A7D";
const BRASS = "#B08D3C";
const IVORY = "#F2E9D8";
const SAND = "#E4D5B7";

/** Metres in front of the viewer. Closer than ~1m and the eyes have to cross
 * uncomfortably to fuse the two images; further than ~2m and the text shrinks
 * past legibility on a half-width eye viewport. */
const PANEL_DISTANCE = 1.45;
const PANEL_WIDTH = 1.05;
const PANEL_EYE_DROP = 0.12; // sit slightly below the horizon, like a lectern

const TEXT_WIDTH = PANEL_WIDTH - 0.12;
const TITLE_SIZE = 0.055;
const BODY_SIZE = 0.032;
const FACT_LABEL_SIZE = 0.022;
const FACT_SIZE = 0.027;
const FOOTER_SIZE = 0.026;
const AUDIO_SIZE = 0.026;
const AUDIO_BAR_HEIGHT = 0.006;
const AUDIO_BAR_GAP = 0.014;

/**
 * How many consecutive motionless frames end the "follow the camera" phase.
 *
 * Six is about a tenth of a second at 60fps: long enough that a momentary pause
 * partway through the approach does not freeze the panel early, short enough
 * that it is parked before the visitor has finished looking up.
 */
const STILL_FRAMES_BEFORE_PARKED = 6;

const PAD_TOP = 0.06;
const PAD_BOTTOM = 0.05;
const GAP = 0.035;

/**
 * Rough line count for a `<Text>` block, used to size the panel to its content.
 *
 * The panel used to be a fixed 0.62m tall, which worked only because every
 * description was chopped to the same two sentences. Now that a "Tahukah Anda?"
 * fact can sit under the body — and only for some artifacts — a fixed height
 * either clips the tail or leaves a dead band of indigo under short entries.
 *
 * Estimating rather than measuring is deliberate: troika's real extents arrive
 * asynchronously via onSync, one frame *after* the panel has already been drawn
 * and parked in world space, so laying out from them would visibly reflow the
 * panel in the headset. The 0.52 factor is the average advance width of this
 * font relative to its size, and the 0.92 slack accounts for wrapping at word
 * boundaries rather than mid-word.
 */
function estimateLines(text: string, fontSize: number): number {
  const charsPerLine = (TEXT_WIDTH / (fontSize * 0.52)) * 0.92;
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

/**
 * The artifact information panel used while VR mode is active — a real object
 * in the scene rather than a DOM overlay.
 *
 * That choice is the whole point. A DOM panel sits on top of the canvas, which
 * in stereo mode means it is drawn once, across the seam between two eye
 * viewports, outside the barrel distortion and at no particular depth. Nothing
 * about it survives the trip through a Cardboard lens. Geometry in the scene,
 * by contrast, is rendered twice by the same stereo camera that draws
 * everything else, so it lands in both eyes at matching height, with the same
 * distortion and a depth the eyes can actually converge on — for free.
 *
 * The panel's world position is captured once, when it opens, and never
 * follows the head afterwards. A panel welded to head motion is one of the
 * more reliable ways to make someone ill; leaving it parked in space lets the
 * visitor look away from it and back at the object.
 */
export function VRInfoPanel() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const { camera } = useThree();
  /**
   * The same shared player the flat panel drives — read here, never started
   * from here.
   *
   * Drawn as scene geometry rather than as a DOM overlay for the same reason
   * the whole panel is: the stereo camera renders this twice, so both eyes get
   * an identical control at an identical depth. A DOM button would be painted
   * once, across the seam between the two eye viewports and outside the barrel
   * distortion, which is exactly the "tombolnya berbeda antara mata kiri dan
   * kanan" failure this had to avoid.
   */
  const audio = useAudioGuide(focusedArtifact);
  const groupRef = useRef<THREE.Group>(null);
  const placed = useRef(false);
  /**
   * Where the camera was on the previous frame, and how long it has been there.
   *
   * The panel used to park itself on the very first frame after opening, and
   * that frame is the worst possible moment to choose: focusing an artifact
   * starts a camera move towards it, so the panel was left standing at the spot
   * the visitor was walking away from and the rig then flew straight past it.
   * In a headset the result was simply nothing — press A, get no panel — with
   * the panel sitting somewhere behind the viewer the whole time.
   *
   * So placement now waits for the approach to finish. The panel is re-parked
   * every frame the camera is still travelling and freezes once it has been
   * still for a few frames, which is the same "parked in world space, does not
   * follow the head" behaviour, just anchored to where the visitor ends up
   * instead of where they started.
   */
  const lastCameraPos = useRef(new THREE.Vector3());
  const stillFrames = useRef(0);

  const isOpen = isVRMode && !!focusedArtifact;

  useEffect(() => {
    // Re-place each time the panel opens (or the artifact changes), so it
    // appears in front of wherever the visitor ends up.
    placed.current = false;
    stillFrames.current = 0;
    lastCameraPos.current.set(Infinity, Infinity, Infinity);
  }, [focusedArtifact, isVRMode]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !isOpen || placed.current) return;

    // "Still" is generous on purpose: the approach eases out, so the last
    // centimetres are covered very slowly and a tight threshold would freeze
    // the panel just short of the visitor's final position.
    const moved = camera.position.distanceToSquared(lastCameraPos.current) > 1e-6;
    lastCameraPos.current.copy(camera.position);
    stillFrames.current = moved ? 0 : stillFrames.current + 1;

    // Park the panel a fixed distance along the direction the viewer is facing,
    // flattened to the horizontal plane so it never ends up above or below them
    // no matter how their head was tilted at the moment of opening.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    group.position
      .copy(camera.position)
      .addScaledVector(forward, PANEL_DISTANCE)
      .setY(camera.position.y - PANEL_EYE_DROP);
    group.lookAt(camera.position.x, group.position.y, camera.position.z);

    // ~6 frames of stillness, then it stops following for good.
    if (stillFrames.current >= STILL_FRAMES_BEFORE_PARKED) placed.current = true;
  });

  /**
   * Layout is derived from the text, top-down, so the ground plane, the fact
   * block and the footer all agree on one height.
   *
   * The body is `deskripsi_singkat` — a sentence written to stand alone —
   * rather than the old sentence-count trim of `deskripsi`. That trim took
   * whatever the first two sentences happened to be, which after the curator
   * rewrite is often pure visual description ("Tulangnya telah membatu…") with
   * the identifying fact stranded in paragraph two.
   */
  const layout = useMemo(() => {
    if (!focusedArtifact) return null;
    const body = focusedArtifact.deskripsi_singkat;
    const fact = focusedArtifact.fakta_menarik;

    const titleH = estimateLines(focusedArtifact.nama, TITLE_SIZE) * TITLE_SIZE * 1.15;
    const bodyH = estimateLines(body, BODY_SIZE) * BODY_SIZE * 1.35;
    const factLabelH = FACT_LABEL_SIZE * 1.5;
    const factH = fact ? factLabelH + estimateLines(fact, FACT_SIZE) * FACT_SIZE * 1.3 : 0;
    const footerH = FOOTER_SIZE * 1.2;
    /**
     * The audio row reserves its full height — label, gap and progress bar —
     * from the moment the panel opens, even though the bar only means anything
     * once something is playing. Sizing it to the current state instead would
     * make the panel grow the instant the visitor pressed X, and a panel that
     * changes size in front of a headset visitor is the kind of motion this
     * whole component is built to avoid.
     */
    const hasAudio = Boolean(focusedArtifact.audioGuide?.contentVerified);
    const audioH = hasAudio ? AUDIO_SIZE * 1.2 + AUDIO_BAR_GAP + AUDIO_BAR_HEIGHT : 0;

    const height =
      PAD_TOP +
      titleH +
      GAP +
      bodyH +
      (fact ? GAP + factH : 0) +
      (hasAudio ? GAP + audioH : 0) +
      GAP +
      footerH +
      PAD_BOTTOM;

    let cursor = height / 2 - PAD_TOP;
    const titleY = cursor;
    cursor -= titleH + GAP;
    const bodyY = cursor;
    cursor -= bodyH + GAP;
    const factY = cursor;

    // The audio row is anchored from the bottom, above the footer, so it sits
    // in the same place whether or not the artifact has a "Tahukah Anda?" block.
    const audioBarY = -height / 2 + PAD_BOTTOM + footerH + GAP;
    const audioTextY = audioBarY + AUDIO_BAR_HEIGHT + AUDIO_BAR_GAP;

    return {
      body,
      fact,
      height,
      titleY,
      bodyY,
      factY,
      factH,
      factLabelH,
      hasAudio,
      audioBarY,
      audioTextY,
    };
  }, [focusedArtifact]);

  if (!isOpen || !focusedArtifact || !layout) return null;

  const {
    body,
    fact,
    height,
    titleY,
    bodyY,
    factY,
    factH,
    factLabelH,
    hasAudio,
    audioBarY,
    audioTextY,
  } = layout;

  return (
    <group ref={groupRef}>
      {/* Ground. Opaque rather than translucent: transparent panels stack
          overdraw and, worse, let the scene behind bleed through the text at
          exactly the moment it needs contrast most. */}
      <mesh>
        <planeGeometry args={[PANEL_WIDTH, height]} />
        <meshBasicMaterial color={INDIGO} toneMapped={false} />
      </mesh>
      {/* Brass frame — one slightly larger plane behind, no extra transparency. */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[PANEL_WIDTH + 0.02, height + 0.02]} />
        <meshBasicMaterial color={BRASS} toneMapped={false} />
      </mesh>

      <Text
        position={[-PANEL_WIDTH / 2 + 0.06, titleY, 0.001]}
        anchorX="left"
        anchorY="top"
        // ~0.055m tall at 1.45m ≈ 2.2° of arc — comfortably above the ~2%
        // of viewport height that stays legible on a half-width eye view.
        fontSize={TITLE_SIZE}
        maxWidth={TEXT_WIDTH}
        lineHeight={1.15}
        color={IVORY}
        outlineWidth={0.002}
        outlineColor="#000000"
      >
        {focusedArtifact.nama}
      </Text>

      <Text
        position={[-PANEL_WIDTH / 2 + 0.06, bodyY, 0.001]}
        anchorX="left"
        anchorY="top"
        fontSize={BODY_SIZE}
        maxWidth={TEXT_WIDTH}
        lineHeight={1.35}
        color={SAND}
      >
        {body}
      </Text>

      {/* "Tahukah Anda?" — same brass rule as the flat panel, as a thin quad.
          Absent entirely (rule included) for artifacts with no sourced fact. */}
      {fact && (
        <>
          <mesh position={[-PANEL_WIDTH / 2 + 0.042, factY - factH / 2, 0.001]}>
            <planeGeometry args={[0.005, factH]} />
            <meshBasicMaterial color={BRASS} toneMapped={false} />
          </mesh>
          <Text
            position={[-PANEL_WIDTH / 2 + 0.06, factY, 0.001]}
            anchorX="left"
            anchorY="top"
            fontSize={FACT_LABEL_SIZE}
            maxWidth={TEXT_WIDTH}
            color={BRASS}
          >
            TAHUKAH ANDA?
          </Text>
          <Text
            position={[-PANEL_WIDTH / 2 + 0.06, factY - factLabelH, 0.001]}
            anchorX="left"
            anchorY="top"
            fontSize={FACT_SIZE}
            maxWidth={TEXT_WIDTH}
            lineHeight={1.3}
            color={IVORY}
          >
            {fact}
          </Text>
        </>
      )}

      {/* Audio guide. Present only for artifacts with a verified narration,
          and the only way to reach one in VR: there is no touch HUD in this
          mode, so the gamepad X button is the control and this row is its
          entire display. */}
      {hasAudio && (
        <>
          <Text
            position={[-PANEL_WIDTH / 2 + 0.06, audioTextY, 0.001]}
            anchorX="left"
            anchorY="bottom"
            fontSize={AUDIO_SIZE}
            maxWidth={TEXT_WIDTH}
            color={audio.isError ? SAND : BRASS}
          >
            {audioLabel(audio)}
          </Text>
          {/* Track. Kept visible at rest too, so the row does not appear to
              gain a component the moment playback starts. */}
          <mesh position={[0, audioBarY + AUDIO_BAR_HEIGHT / 2, 0.001]}>
            <planeGeometry args={[TEXT_WIDTH, AUDIO_BAR_HEIGHT]} />
            <meshBasicMaterial color={INDIGO} toneMapped={false} />
          </mesh>
          {audio.progress > 0 && (
            <mesh
              position={[
                -TEXT_WIDTH / 2 + (TEXT_WIDTH * audio.progress) / 2,
                audioBarY + AUDIO_BAR_HEIGHT / 2,
                0.002,
              ]}
            >
              <planeGeometry args={[TEXT_WIDTH * audio.progress, AUDIO_BAR_HEIGHT]} />
              <meshBasicMaterial color={BRASS} toneMapped={false} />
            </mesh>
          )}
        </>
      )}

      <Text
        position={[0, -height / 2 + PAD_BOTTOM, 0.001]}
        anchorX="center"
        anchorY="bottom"
        fontSize={FOOTER_SIZE}
        color={BRASS}
      >
        Tombol B pada gamepad untuk kembali menjelajah
      </Text>
    </group>
  );
}

/**
 * One line of text carrying the whole player: what state it is in, how far
 * along it is, and which button changes that.
 *
 * Spelled out rather than reduced to icons because inside a headset there is no
 * tooltip, no hover and no second glance — whatever this line says is all the
 * visitor will ever be told about the control.
 */
function audioLabel(audio: ReturnType<typeof useAudioGuide>): string {
  if (audio.isError) return "Narasi gagal dimuat \u2014 tombol X untuk mencoba lagi";
  if (audio.isLoading) return "Memuat narasi\u2026";
  const [, total] = audio.timeLabel.split(" / ");
  if (audio.isPlaying) return "\u275a\u275a  " + audio.timeLabel + "  \u00b7  tombol X untuk jeda";
  if (audio.status === "paused") return "\u25b6  " + audio.timeLabel + "  \u00b7  tombol X untuk lanjut";
  return "\u25b6  Pemandu audio  \u00b7  " + total + "  \u00b7  tombol X";
}
