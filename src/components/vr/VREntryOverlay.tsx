import { useEffect, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

const CONTINUE_DELAY_SECONDS = 4;

interface VREntryOverlayProps {
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * Shown after the user taps "Masuk Mode VR" and permissions/fullscreen/
 * landscape-lock have already been requested, but before the stereo view
 * actually activates — gives them a few seconds to physically slot the
 * phone into the Cardboard viewer first.
 */
export function VREntryOverlay({ onContinue, onCancel }: VREntryOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(CONTINUE_DELAY_SECONDS);
  // Many browsers don't fire `gamepadconnected` (or return the pad from
  // navigator.getGamepads()) until the user presses a button first, so we
  // surface the live detection state here and tell them to press any button —
  // useGamepadControls flips this to true the moment it sees the pad.
  const isGamepadConnected = useMuseumStore((s) => s.isGamepadConnected);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="glass-panel w-[92vw] max-w-[480px] rounded-2xl p-6 sm:p-8 text-center text-museum-bone shadow-2xl animate-slide-up-fade">
        <h2 className="font-display text-2xl mb-3">Pasangkan HP ke Cardboard Sekarang</h2>
        <p className="text-museum-mist text-sm leading-relaxed mb-5">
          Gunakan gamepad untuk bergerak, tombol <span className="text-museum-gold">A</span> untuk
          berinteraksi, tombol <span className="text-museum-gold">Select/Back</span> untuk kalibrasi
          ulang arah pandang, dan tombol <span className="text-museum-gold">Start</span> untuk keluar
          dari Mode VR kapan saja.
        </p>

        {/* Live gamepad detection — press any button to make the browser see it. */}
        <div
          className={`flex items-center justify-center gap-2 mb-6 rounded-full px-4 py-2 text-xs border ${
            isGamepadConnected
              ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/5"
              : "border-white/15 text-museum-mist bg-white/5"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isGamepadConnected ? "bg-emerald-400" : "bg-museum-mist/50 animate-pulse"
            }`}
          />
          {isGamepadConnected
            ? "Gamepad terdeteksi — siap dipakai"
            : "Pastikan gamepad terhubung Bluetooth, lalu tekan tombol apa saja untuk memulai"}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onCancel}
            className="py-3 px-5 rounded-full border border-white/20 text-museum-mist hover:text-museum-bone hover:border-museum-gold/50 transition-all text-sm"
          >
            Batal
          </button>
          <button
            onClick={onContinue}
            disabled={secondsLeft > 0}
            className="py-3 px-6 rounded-full bg-museum-gold text-museum-void font-semibold text-sm border border-museum-gold hover:bg-museum-gold/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {secondsLeft > 0 ? `Lanjutkan (${secondsLeft})` : "Lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );
}
