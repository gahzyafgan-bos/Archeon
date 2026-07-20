import React, { useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { GRAPHICS_QUALITY_LABELS, type GraphicsQuality } from "@/utils/graphicsPresets";

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<"controls" | "audio" | "visual" | "vr">("controls");
  const isSettingsOpen = useMuseumStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useMuseumStore((s) => s.setIsSettingsOpen);
  const settings = useMuseumStore((s) => s.settings);
  const updateSettings = useMuseumStore((s) => s.updateSettings);
  const resetSettings = useMuseumStore((s) => s.resetSettings);
  const setHasCompletedOnboarding = useMuseumStore((s) => s.setHasCompletedOnboarding);
  const setGraphicsQuality = useMuseumStore((s) => s.setGraphicsQuality);

  if (!isSettingsOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setIsSettingsOpen(false);
  };

  const deadzoneMap: Record<string, number> = { small: 0.05, medium: 0.1, large: 0.2 };
  const reverseDeadzoneMap: Record<number, string> = { 0.05: "small", 0.1: "medium", 0.2: "large" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
      onClick={handleOverlayClick}
    >
      {/* max-h + flex-col: same 3-zone pattern as OnboardingFlow — header and
          footer (Reset/Replay) are fixed zones that must always stay
          reachable in short landscape viewports; only the tab content
          between them scrolls. */}
      <div className="glass-panel w-[90vw] max-w-[600px] max-h-[92dvh] rounded-2xl flex flex-col text-museum-bone shadow-2xl animate-slide-up-fade">
        {/* Header (fixed) */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display text-2xl">Pengaturan</h2>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-museum-charcoal/40 hover:bg-museum-charcoal/60 transition-colors"
            aria-label="Tutup pengaturan"
          >
            ✕
          </button>
        </div>

        {/* Scrollable middle: tabs + tab content */}
        <div className="museum-scroll-fade flex-1 min-h-0 overflow-y-auto museum-scroll px-6 pb-6">
          <div className="mb-6 flex gap-2 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === "controls"
                  ? "bg-museum-gold/20 text-museum-gold border border-museum-gold/50"
                  : "text-museum-mist hover:text-museum-bone"
              }`}
            >
              Kontrol
            </button>
            <button
              onClick={() => setActiveTab("audio")}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === "audio"
                  ? "bg-museum-gold/20 text-museum-gold border border-museum-gold/50"
                  : "text-museum-mist hover:text-museum-bone"
              }`}
            >
              Suara
            </button>
            <button
              onClick={() => setActiveTab("visual")}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === "visual"
                  ? "bg-museum-gold/20 text-museum-gold border border-museum-gold/50"
                  : "text-museum-mist hover:text-museum-bone"
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setActiveTab("vr")}
              className={`px-4 py-2 rounded-full transition-all ${
                activeTab === "vr"
                  ? "bg-museum-gold/20 text-museum-gold border border-museum-gold/50"
                  : "text-museum-mist hover:text-museum-bone"
              }`}
            >
              Mode VR
            </button>
          </div>

          {activeTab === "controls" && (
            <div className="space-y-6">
              {/* Look Sensitivity */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Sensitivitas Pandangan</label>
                  <span className="text-museum-gold">{Math.round(settings.lookSensitivity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.lookSensitivity}
                  onChange={(e) => updateSettings({ lookSensitivity: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Move Sensitivity */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Sensitivitas Gerakan</label>
                  <span className="text-museum-gold">{Math.round(settings.moveSensitivity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.moveSensitivity}
                  onChange={(e) => updateSettings({ moveSensitivity: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Deadzone */}
              <div>
                <div className="mb-2">
                  <label>Ukuran Deadzone</label>
                </div>
                <div className="flex gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ deadzone: size })}
                      className={`flex-1 py-2 rounded-full border transition-all ${
                        settings.deadzone === size
                          ? "bg-museum-gold/20 border-museum-gold/50 text-museum-gold"
                          : "border-white/10 text-museum-mist hover:text-museum-bone"
                      }`}
                    >
                      {size === "small" ? "Kecil" : size === "medium" ? "Sedang" : "Besar"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invert Y */}
              <div className="flex items-center justify-between">
                <label>Balikkan Pandangan Atas/Bawah</label>
                <button
                  onClick={() => updateSettings({ invertY: !settings.invertY })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.invertY
                      ? "bg-museum-gold/20 border border-museum-gold/50 text-museum-gold"
                      : "bg-museum-charcoal/50"
                  }`}
                >
                  {settings.invertY ? "On" : "Off"}
                </button>
              </div>

              {/* Control Mode */}
              <div>
                <div className="mb-2">
                  <label>Mode Kontrol</label>
                </div>
                <div className="flex gap-2">
                  {(["auto", "keyboard", "joystick"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateSettings({ controlMode: mode })}
                      className={`flex-1 py-2 rounded-full border transition-all ${
                        settings.controlMode === mode
                          ? "bg-museum-gold/20 border-museum-gold/50 text-museum-gold"
                          : "border-white/10 text-museum-mist hover:text-museum-bone"
                      }`}
                    >
                      {mode === "auto" ? "Otomatis" : mode === "keyboard" ? "Keyboard" : "Joystick"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "audio" && (
            <div className="space-y-6">
              {/* Master Mute */}
              <div className="flex items-center justify-between">
                <label>Matikan Semua Suara</label>
                <button
                  onClick={() => updateSettings({ masterMuted: !settings.masterMuted })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.masterMuted
                      ? "bg-museum-gold/20 border border-museum-gold/50 text-museum-gold"
                      : "bg-museum-charcoal/50"
                  }`}
                >
                  {settings.masterMuted ? "On" : "Off"}
                </button>
              </div>

              {/* Volume Ambience */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Volume Musik Latar</label>
                  <span className="text-museum-gold">{settings.volumeAmbience}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.volumeAmbience}
                  onChange={(e) => updateSettings({ volumeAmbience: parseInt(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Volume Guide */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Volume Audio Guide</label>
                  <span className="text-museum-gold">{settings.volumeGuide}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.volumeGuide}
                  onChange={(e) => updateSettings({ volumeGuide: parseInt(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Volume UI */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Volume Efek UI</label>
                  <span className="text-museum-gold">{settings.volumeUI}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.volumeUI}
                  onChange={(e) => updateSettings({ volumeUI: parseInt(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Show Subtitles */}
              <div className="flex items-center justify-between">
                <label>Tampilkan Teks Audio Guide</label>
                <button
                  onClick={() => updateSettings({ showSubtitles: !settings.showSubtitles })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.showSubtitles
                      ? "bg-museum-gold/20 border border-museum-gold/50 text-museum-gold"
                      : "bg-museum-charcoal/50"
                  }`}
                >
                  {settings.showSubtitles ? "On" : "Off"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "visual" && (
            <div className="space-y-6">
              {/* Graphics Quality */}
              <div>
                <div className="mb-2">
                  <label>Kualitas Grafis</label>
                </div>
                <div className="flex gap-2">
                  {(Object.keys(GRAPHICS_QUALITY_LABELS) as GraphicsQuality[]).map((quality) => (
                    <button
                      key={quality}
                      onClick={() => setGraphicsQuality(quality)}
                      className={`flex-1 py-2 rounded-full border transition-all ${
                        settings.graphicsQuality === quality
                          ? "bg-museum-gold/20 border-museum-gold/50 text-museum-gold"
                          : "border-white/10 text-museum-mist hover:text-museum-bone"
                      }`}
                    >
                      {GRAPHICS_QUALITY_LABELS[quality].title}
                    </button>
                  ))}
                </div>
                <p className="text-museum-mist/70 text-[10px] mt-1">
                  {GRAPHICS_QUALITY_LABELS[settings.graphicsQuality].desc}
                </p>
              </div>

              {/* Reduce Motion */}
              <div className="flex items-center justify-between">
                <label>Kurangi Gerakan Kamera (Anti Mabuk)</label>
                <button
                  onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.reduceMotion
                      ? "bg-museum-gold/20 border border-museum-gold/50 text-museum-gold"
                      : "bg-museum-charcoal/50"
                  }`}
                >
                  {settings.reduceMotion ? "On" : "Off"}
                </button>
              </div>

              {/* Camera FOV */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Lebar Pandangan Kamera (FOV)</label>
                  <span className="text-museum-gold">{settings.cameraFOV}°</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="85"
                  step="1"
                  value={settings.cameraFOV}
                  onChange={(e) => updateSettings({ cameraFOV: parseInt(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <label>Mode Kontras Tinggi</label>
                <button
                  onClick={() => updateSettings({ highContrast: !settings.highContrast })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    settings.highContrast
                      ? "bg-museum-gold/20 border border-museum-gold/50 text-museum-gold"
                      : "bg-museum-charcoal/50"
                  }`}
                >
                  {settings.highContrast ? "On" : "Off"}
                </button>
              </div>

              {/* Text Size */}
              <div>
                <div className="mb-2">
                  <label>Ukuran Teks</label>
                </div>
                <div className="flex gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSettings({ textSize: size })}
                      className={`flex-1 py-2 rounded-full border transition-all ${
                        settings.textSize === size
                          ? "bg-museum-gold/20 border-museum-gold/50 text-museum-gold"
                          : "border-white/10 text-museum-mist hover:text-museum-bone"
                      }`}
                    >
                      {size === "small" ? "Kecil" : size === "medium" ? "Sedang" : "Besar"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Transition Speed */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Kecepatan Transisi Ruangan</label>
                  <span className="text-museum-gold">{Math.round(settings.roomTransitionSpeed * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.roomTransitionSpeed}
                  onChange={(e) => updateSettings({ roomTransitionSpeed: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>
            </div>
          )}

          {activeTab === "vr" && (
            <div className="space-y-6">
              <p className="text-museum-mist text-xs leading-relaxed -mt-2">
                Kalibrasi untuk Mode VR Cardboard. Sesuaikan sambil melihat lewat lensa sampai
                gambar kiri-kanan menyatu jadi satu dan terasa nyaman di mata.
              </p>

              {/* IPD (Interpupillary Distance) */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Jarak Antar Mata (IPD)</label>
                  <span className="text-museum-gold">{Math.round(settings.vrIPD * 1000)} mm</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.075"
                  step="0.001"
                  value={settings.vrIPD}
                  onChange={(e) => updateSettings({ vrIPD: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
                <p className="text-museum-mist/70 text-[10px] mt-1">
                  Jika gambar terasa "kebelah" atau kedalaman 3D kurang terasa, coba ubah nilai ini.
                </p>
              </div>

              {/* Barrel distortion K1 */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Distorsi Lensa (K1)</label>
                  <span className="text-museum-gold">{settings.vrDistortionK1.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={settings.vrDistortionK1}
                  onChange={(e) => updateSettings({ vrDistortionK1: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
              </div>

              {/* Barrel distortion K2 */}
              <div>
                <div className="mb-2 flex justify-between">
                  <label>Distorsi Lensa (K2)</label>
                  <span className="text-museum-gold">{settings.vrDistortionK2.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={settings.vrDistortionK2}
                  onChange={(e) => updateSettings({ vrDistortionK2: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-museum-charcoal/50 rounded-lg appearance-none cursor-pointer accent-museum-gold"
                />
                <p className="text-museum-mist/70 text-[10px] mt-1">
                  Naikkan K1/K2 kalau tepi gambar masih terlihat melengkung lewat lensa; turunkan
                  kalau tengah gambar terasa "ditarik" atau terlalu banyak area hitam di tepi.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Reset and Replay Intro (fixed zone, always reachable) */}
        <div
          className="flex-shrink-0 px-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        >
          <button
            onClick={() => {
              setIsSettingsOpen(false);
              setHasCompletedOnboarding(false);
            }}
            className="flex-1 py-3 rounded-full border border-museum-gold/30 text-museum-gold hover:text-museum-bone hover:border-museum-gold/60 transition-all text-sm font-semibold"
          >
            Lihat Perkenalan Lagi
          </button>
          <button
            onClick={() => {
              resetSettings();
            }}
            className="flex-1 py-3 rounded-full border border-white/20 text-museum-mist hover:text-museum-bone hover:border-museum-gold/50 transition-all text-sm"
          >
            Kembalikan ke Pengaturan Awal
          </button>
        </div>
      </div>
    </div>
  );
}
