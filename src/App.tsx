import { MuseumExperience } from "@/components/MuseumExperience";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { RoomTransition } from "@/components/ui/RoomTransition";
import { OnboardingFlow } from "@/components/ui/OnboardingFlow";
import { HUD } from "@/components/ui/HUD";
import { InfoPanel } from "@/components/ui/InfoPanel";
import { VRHud } from "@/components/vr/VRHud";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { useMouseLookControls } from "@/hooks/useMouseLookControls";
import { useInteractionKeys } from "@/hooks/useInteractionKeys";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useEffect, useState } from "react";

export default function App() {
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

  useDeviceDetection();
  useKeyboardControls();
  useMouseLookControls(rootEl);
  useInteractionKeys();

  useEffect(() => {
    // Reset onboarding state on every mount (fresh page load)
    useMuseumStore.getState().setHasCompletedOnboarding(false);
  }, []);

  return (
    <div ref={setRootEl} className="relative w-full h-full bg-museum-void overflow-hidden">
      <MuseumExperience />
      <HUD />
      <VRHud />
      <InfoPanel />
      <RoomTransition />
      <OnboardingFlow />
      <LoadingScreen />
    </div>
  );
}
