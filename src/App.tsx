import { MuseumExperience } from "@/components/MuseumExperience";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { RoomTransition } from "@/components/ui/RoomTransition";
import { OnboardingFlow } from "@/components/ui/OnboardingFlow";
import { HUD } from "@/components/ui/HUD";
import { InfoPanel } from "@/components/ui/InfoPanel";
import { VRHud } from "@/components/vr/VRHud";
import { LandscapeGate } from "@/components/ui/LandscapeGate";
import { IOSInstallBanner } from "@/components/ui/IOSInstallBanner";
import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary";
import { FatalErrorScreen, detectWebGLSupport } from "@/components/ui/FatalErrorScreen";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { useMouseLookControls } from "@/hooks/useMouseLookControls";
import { useInteractionKeys } from "@/hooks/useInteractionKeys";
import { useGuideAudioLifecycle } from "@/hooks/useAudioGuide";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useEffect, useState } from "react";

/**
 * Probed once at module scope, before React renders anything.
 *
 * Deliberately not inside a hook or an effect: if there is no WebGL at all,
 * the museum must never get as far as constructing a renderer. three throws
 * from inside the WebGLRenderer constructor, and by the time an error boundary
 * sees that, React has already unmounted the tree — which is precisely how a
 * device without WebGL ended up staring at an empty <div id="root">.
 */
const HAS_WEBGL = detectWebGLSupport();

/**
 * How long the page has to sit in the background before returning to it counts
 * as a new visit rather than a pause. Ten minutes is comfortably longer than
 * taking the phone out of a viewer to read a message, and comfortably shorter
 * than "someone else picked this device up".
 */
const SESSION_IDLE_RESET_MS = 10 * 60 * 1000;

export default function App() {
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const isRendererLost = useMuseumStore((s) => s.isRendererLost);
  const highContrast = useMuseumStore((s) => s.settings.highContrast);

  useViewportHeight();
  useDeviceDetection();
  useKeyboardControls();
  useMouseLookControls(rootEl);
  useInteractionKeys();
  // Mounted here, not in a panel: the audio guide has to keep following the
  // volume settings and has to stop on a hall change or a VR toggle even when
  // no panel happens to be rendered at that instant.
  useGuideAudioLifecycle();

  /**
   * A new visit starts at the beginning — including a "visit" the browser
   * hands back without ever remounting this component.
   *
   * A fresh load is covered by the mount below. The other two paths are not,
   * and they are the ones a phone actually takes:
   *
   *  - `pageshow` with `persisted` is the back/forward cache: the tab was put
   *    to sleep with its JavaScript intact and woken up later. No mount runs,
   *    so whatever mode the last person left behind is still switched on. This
   *    is how someone who tried Mode VR yesterday opens the link today and
   *    lands directly in a split-screen stereo view, which on a phone without a
   *    Cardboard viewer reads as an app that is broken, not as a feature.
   *  - Coming back after a long spell in the background is the same situation
   *    on devices that keep the page resident instead of freezing it. Long, not
   *    any: stepping out of a headset to answer a message and coming straight
   *    back must not throw the visitor out of the museum.
   */
  useEffect(() => {
    const reset = () => useMuseumStore.getState().resetSessionState();
    reset();

    let hiddenSince = 0;
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
        return;
      }
      if (hiddenSince && Date.now() - hiddenSince >= SESSION_IDLE_RESET_MS) reset();
      hiddenSince = 0;
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Publishes "Mode Kontras Tinggi" as an attribute on <html>, which is what
  // the stylesheet keys off. An attribute rather than React state threaded
  // through every panel: the rules it drives are CSS overrides on shared
  // classes, so one flag at the root reaches all of them without a single
  // component needing to know the setting exists. See index.css.
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) root.setAttribute("data-contrast", "high");
    else root.removeAttribute("data-contrast");
  }, [highContrast]);

  if (!HAS_WEBGL) {
    return (
      <FatalErrorScreen
        title="Perangkat ini belum bisa menampilkan museum 3D"
        body={
          <>
            Museum virtual ini menggambar ruangannya secara langsung memakai kemampuan
            grafis perangkat. Browser di perangkat ini belum mengizinkannya, jadi
            ruangannya tidak bisa ditampilkan.
          </>
        }
        hint="Yang biasanya membantu: perbarui browser ke versi terbaru, matikan mode hemat data atau mode hemat baterai, lalu buka lagi. Kalau tetap tidak bisa, museum ini dapat dibuka lewat perangkat lain yang lebih baru."
        actionLabel="Coba Lagi"
      />
    );
  }

  return (
    <AppErrorBoundary>
      <div ref={setRootEl} className="relative w-full h-full bg-museum-void overflow-hidden">
        <MuseumExperience />
        <HUD />
        <VRHud />
        <InfoPanel />
        <RoomTransition />
        <OnboardingFlow />
        <LoadingScreen />
        <IOSInstallBanner />
        {/* Landscape gate sits above everything (incl. onboarding) so it can
            block portrait interaction in any app state, touch devices only. */}
        <LandscapeGate />
        {/* Above even the landscape gate: when the GPU has taken the context
            away there is nothing behind any of these layers to interact with,
            so the message must not be something a visitor can end up under. */}
        {isRendererLost && (
          <FatalErrorScreen
            title="Tampilan 3D terhenti sementara"
            body={
              <>
                Perangkat ini menghentikan penggambaran ruangan museum — biasanya karena
                memori grafisnya penuh, atau halaman terlalu lama berada di latar belakang.
              </>
            }
            hint="Kalau ini sering terjadi, buka Pengaturan → Visual dan pilih kualitas grafis Rendah, atau tutup tab dan aplikasi lain yang sedang berjalan."
          />
        )}
      </div>
    </AppErrorBoundary>
  );
}
