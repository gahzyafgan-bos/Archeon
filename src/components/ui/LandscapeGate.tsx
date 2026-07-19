import { useEffect, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/** Reactively tracks whether the screen is currently in portrait orientation. */
function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(orientation: portrait)").matches;
  });

  useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    const update = () => setIsPortrait(mql.matches);
    update();
    // `change` on the MediaQueryList is the modern, reliable signal; also
    // listen to orientationchange/resize as a belt-and-braces fallback.
    mql.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return isPortrait;
}

/**
 * Full-screen gate that asks touch/mobile users to rotate to landscape before
 * (and during) the experience. It reacts to orientation changes in real time —
 * no confirm button — and disappears the instant the device is landscape.
 * Desktop / non-touch devices never see it. Rendered last in App.tsx so it
 * overlays every other UI layer (onboarding included).
 */
export function LandscapeGate() {
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const isPortrait = useIsPortrait();

  if (!isTouchDevice || !isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-museum-void/95 backdrop-blur-md px-8 text-center">
      <style>{`
        @keyframes phone-rotate {
          0%, 15%   { transform: rotate(0deg); }
          45%, 70%  { transform: rotate(-90deg); }
          100%      { transform: rotate(-90deg); }
        }
      `}</style>

      {/* Rotating phone illustration */}
      <div
        className="relative w-16 h-28 rounded-[14px] border-2 border-museum-gold/70 flex flex-col items-center justify-center gap-2"
        style={{ animation: "phone-rotate 2.8s ease-in-out infinite" }}
      >
        <div className="w-8 h-14 rounded bg-museum-gold/15" />
        <div className="w-1.5 h-1.5 rounded-full bg-museum-gold/70" />
      </div>

      <div className="flex flex-col items-center gap-3 max-w-xs">
        <h2 className="font-display text-2xl text-museum-bone tracking-wide">
          Putar Perangkat Anda
        </h2>
        <p className="text-museum-mist text-sm leading-relaxed">
          Miringkan ponsel ke mode <span className="text-museum-gold">landscape</span> untuk
          pengalaman menjelajah museum yang terbaik.
        </p>
      </div>

      <div className="flex items-center gap-2 text-museum-mist/60 text-[11px] tracking-widest uppercase">
        <span className="w-6 h-[1px] bg-museum-mist/30" />
        Menunggu orientasi layar
        <span className="w-6 h-[1px] bg-museum-mist/30" />
      </div>
    </div>
  );
}
