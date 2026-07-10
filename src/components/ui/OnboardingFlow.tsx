import React, { useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

export function OnboardingFlow() {
  const hasCompletedOnboarding = useMuseumStore((s) => s.hasCompletedOnboarding);
  const setHasCompletedOnboarding = useMuseumStore((s) => s.setHasCompletedOnboarding);
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);

  const [activeSlide, setActiveSlide] = useState(0);

  if (hasCompletedOnboarding) return null;

  const totalSlides = 5;

  const handleNext = () => {
    if (activeSlide < totalSlides - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      setHasCompletedOnboarding(true);
    }
  };

  const handleBack = () => {
    if (activeSlide > 0) {
      setActiveSlide(activeSlide - 1);
    }
  };

  const handleSkip = () => {
    setActiveSlide(totalSlides - 1);
  };

  return (
    <div className="fixed inset-0 z-45 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-500">
      {/* Inline styles for custom onboarding animations */}
      <style>{`
        @keyframes ping-pong {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-8px, -4px); }
          50% { transform: translate(8px, 6px); }
          75% { transform: translate(4px, -8px); }
        }
        @keyframes look-orbit {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(8px, 4px); }
          66% { transform: translate(-8px, -4px); }
        }
        @keyframes hover-bob {
          0%, 100% { transform: translateY(0px) rotate(12deg); }
          50% { transform: translateY(-8px) rotate(12deg); }
        }
        @keyframes ring-pulse {
          0% { transform: scale(0.9); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(0.9); opacity: 0.2; }
        }
        @keyframes key-pulse {
          0%, 100% { background-color: rgba(20, 20, 22, 0.4); border-color: rgba(255, 255, 255, 0.1); color: #8a8a92; }
          50% { background-color: rgba(201, 169, 97, 0.25); border-color: rgba(201, 169, 97, 0.7); color: #c9a961; }
        }
      `}</style>

      {/* Main Container */}
      <div className="glass-panel w-[92vw] max-w-[620px] min-h-[460px] md:min-h-[480px] rounded-2xl flex flex-col justify-between relative overflow-hidden text-museum-bone shadow-2xl animate-slide-up-fade">
        {/* Skip button (only shown if not on the last slide) */}
        {activeSlide < totalSlides - 1 && (
          <button
            onClick={handleSkip}
            className="absolute top-5 right-6 z-50 text-xs text-museum-mist hover:text-museum-gold transition-colors font-semibold tracking-wider uppercase px-2 py-1 rounded bg-museum-charcoal/40 border border-white/5 hover:border-museum-gold/30"
          >
            Lewati Perkenalan
          </button>
        )}

        {/* Slides Track Wrapper */}
        <div className="flex-grow overflow-hidden relative flex flex-col justify-center min-h-[350px]">
          <div
            className="flex h-full transition-transform duration-500 ease-museum w-full"
            style={{
              transform: `translateX(-${activeSlide * 100}%)`,
            }}
          >
            {/* Slide 1: Welcome */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-6 md:px-12 text-center h-full">
              <div className="flex justify-center items-center mb-6">
                <div className="w-16 h-16 border border-museum-gold/30 rotate-45 flex items-center justify-center relative">
                  <div className="absolute inset-0 border border-museum-gold/60 scale-90 animate-ping opacity-45 rounded-sm" />
                  <div className="w-9 h-9 border border-museum-gold/70 rotate-45 flex items-center justify-center bg-museum-gold/5">
                    <div className="w-3.5 h-3.5 bg-museum-gold/60 rotate-45 animate-pulse" />
                  </div>
                </div>
              </div>
              <h2 className="font-display text-2.5xl md:text-3.5xl tracking-wide text-museum-bone mb-4 transition-all duration-700 leading-tight">
                Selamat Datang di <br className="hidden sm:inline" />
                <span className="text-museum-gold">Museum Mpu Tantular Virtual</span>
              </h2>
              <p className="text-museum-mist text-sm md:text-base leading-relaxed max-w-md">
                Jelajahi jejak peradaban Jawa Timur &mdash; dari masa prasejarah, kejayaan Hindu-Buddha, hingga era modern &mdash; dalam satu perjalanan virtual yang menakjubkan.
              </p>
            </div>

            {/* Slide 2: Preview Ruangan */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-6 md:px-10 text-center h-full">
              <h2 className="font-display text-2.5xl md:text-3.5xl tracking-wide text-museum-bone mb-6 leading-tight">
                Tiga Babak Sejarah Menantimu
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mb-2">
                {/* Prasejarah */}
                <div className="flex-1 p-4 rounded-xl bg-museum-charcoal/40 border border-white/5 flex flex-col items-center text-center transition-all hover:border-[#c17a4a]/40 group">
                  <div className="w-10 h-10 flex items-center justify-center mb-2 bg-[#c17a4a]/10 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-[#c17a4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-3 1.5-4.5 3S5 9.5 5 11c0 3 2.5 6 7 10 4.5-4 7-7 7-10 0-1.5-1.5-3.5-3-5S13.2 3 12 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M9 13h6M11 17h2" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-museum-bone mb-1">Prasejarah</h3>
                  <p className="text-xs text-museum-mist leading-relaxed">Jejak awal peradaban manusia purba Nusantara.</p>
                </div>

                {/* Hindu-Buddha */}
                <div className="flex-1 p-4 rounded-xl bg-museum-charcoal/40 border border-white/5 flex flex-col items-center text-center transition-all hover:border-[#e0b868]/40 group">
                  <div className="w-10 h-10 flex items-center justify-center mb-2 bg-[#e0b868]/10 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-[#e0b868]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L9 6h6l-3-4zM6 10l3-4h6l3 4H6zM4 15l2-5h12l2 5H4zM2 21l2-6h16l2 6H2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-museum-bone mb-1">Hindu-Buddha</h3>
                  <p className="text-xs text-museum-mist leading-relaxed">Kejayaan spiritual, arsitektur, dan seni pahat megah.</p>
                </div>

                {/* IPTEK */}
                <div className="flex-1 p-4 rounded-xl bg-museum-charcoal/40 border border-white/5 flex flex-col items-center text-center transition-all hover:border-[#7fa8a3]/40 group">
                  <div className="w-10 h-10 flex items-center justify-center mb-2 bg-[#7fa8a3]/10 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-[#7fa8a3] animate-[spin_10s_linear_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-museum-bone mb-1">Transisi IPTEK</h3>
                  <p className="text-xs text-museum-mist leading-relaxed">Perkembangan teknologi & transisi modernitas.</p>
                </div>
              </div>
            </div>

            {/* Slide 3: Cara Bergerak */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-6 md:px-12 text-center h-full">
              <h2 className="font-display text-2.5xl md:text-3.5xl tracking-wide text-museum-bone mb-2 leading-tight">
                Melangkahlah Bebas
              </h2>
              <p className="text-museum-mist text-xs md:text-sm mb-6 max-w-sm">
                {isTouchDevice
                  ? "Gunakan stik kendali virtual di bagian bawah layar sentuh Anda."
                  : "Gunakan keyboard dan mouse Anda untuk bergerak dan mengarahkan pandangan."}
              </p>

              {isTouchDevice ? (
                /* Mobile Touch Controls Schematic */
                <div className="relative w-64 h-36 border border-white/10 rounded-xl bg-museum-charcoal/80 flex items-center justify-between p-4 shadow-inner mb-2 overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-0 w-2 bg-white/5 flex items-center justify-center">
                    <div className="w-1 h-8 rounded bg-white/20" />
                  </div>
                  <div className="absolute top-0 bottom-0 right-0 w-2 bg-white/5" />
                  
                  {/* Left joystick */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-full border border-museum-gold/30 bg-museum-gold/5 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border border-museum-gold/15 scale-90" />
                      <div className="w-7 h-7 rounded-full bg-museum-gold border border-museum-gold/80 shadow-md animate-[ping-pong_3.5s_ease-in-out_infinite]" />
                    </div>
                    <span className="text-[9px] text-museum-gold font-mono tracking-wider uppercase">Gerak</span>
                  </div>

                  {/* Canvas screen decoration */}
                  <div className="text-center py-1 opacity-45">
                    <span className="text-[10px] text-museum-mist block font-mono">Museum</span>
                    <span className="text-[8px] text-museum-mist block uppercase tracking-widest">3D View</span>
                  </div>

                  {/* Right joystick */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 rounded-full border border-museum-gold/30 bg-museum-gold/5 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border border-museum-gold/15 scale-90" />
                      <div className="w-7 h-7 rounded-full bg-museum-gold border border-museum-gold/80 shadow-md animate-[look-orbit_4.5s_ease-in-out_infinite]" />
                    </div>
                    <span className="text-[9px] text-museum-gold font-mono tracking-wider uppercase">Kamera</span>
                  </div>
                </div>
              ) : (
                /* Desktop WASD + Mouse Schematic */
                <div className="flex flex-col sm:flex-row items-center justify-center gap-10 mb-2 w-full max-w-md">
                  {/* WASD Keys */}
                  <div className="flex flex-col gap-1 w-32">
                    <div className="flex justify-center">
                      <div className="w-10 h-10 rounded border border-white/20 bg-museum-charcoal/60 flex items-center justify-center font-semibold text-museum-gold text-sm shadow-md animate-[key-pulse_2s_infinite]">
                        W
                      </div>
                    </div>
                    <div className="flex gap-1 justify-center">
                      <div className="w-10 h-10 rounded border border-white/20 bg-museum-charcoal/60 flex items-center justify-center font-semibold text-sm shadow-md animate-[key-pulse_2.2s_infinite_100ms]">
                        A
                      </div>
                      <div className="w-10 h-10 rounded border border-white/20 bg-museum-charcoal/60 flex items-center justify-center font-semibold text-sm shadow-md animate-[key-pulse_2.4s_infinite_200ms]">
                        S
                      </div>
                      <div className="w-10 h-10 rounded border border-white/20 bg-museum-charcoal/60 flex items-center justify-center font-semibold text-sm shadow-md animate-[key-pulse_2.6s_infinite_300ms]">
                        D
                      </div>
                    </div>
                    <span className="text-[9px] text-center text-museum-mist font-mono tracking-wider uppercase mt-1">Bergerak</span>
                  </div>

                  {/* Divider line */}
                  <div className="hidden sm:block h-14 w-[1px] bg-white/10" />

                  {/* Mouse drag */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-16 rounded-2xl border-2 border-white/30 bg-museum-charcoal/60 flex flex-col justify-start p-1.5 relative shadow-md">
                      <div className="w-1 h-3 bg-museum-gold/75 rounded-full mx-auto" />
                      <div className="absolute -left-5 -right-5 top-7 flex items-center justify-between text-museum-gold/80 font-mono text-[10px] pointer-events-none">
                        <span className="animate-[look-orbit_3s_infinite_alternate]">&larr;</span>
                        <span className="animate-[look-orbit_3s_infinite_alternate_reverse]">&rarr;</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-center text-museum-mist font-mono tracking-wider uppercase">Pandangan (Drag Mouse)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Slide 4: Cara Berinteraksi */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-6 md:px-12 text-center h-full">
              <h2 className="font-display text-2.5xl md:text-3.5xl tracking-wide text-museum-bone mb-2 leading-tight">
                Sentuh Setiap Kisah
              </h2>
              <p className="text-museum-mist text-xs md:text-sm mb-6 max-w-sm">
                Dekati artefak hingga muncul lingkaran bersinar, lalu tekan tombol interaksi untuk melihat info detail & audio guide.
              </p>

              {/* Interaction Visual Animation */}
              <div className="relative w-52 h-32 flex flex-col items-center justify-end mb-2">
                {/* Floating Artifact geometric shape */}
                <div className="w-10 h-10 bg-gradient-to-tr from-museum-gold-dim to-museum-gold rounded border border-museum-gold/60 shadow-lg shadow-museum-gold/20 flex items-center justify-center z-10 animate-[hover-bob_3.2s_ease-in-out_infinite]">
                  <div className="w-5 h-5 border border-white/20 rotate-45 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white/70" />
                  </div>
                </div>

                {/* Pulsing Proximity Glow Ring on pedestal */}
                <div className="absolute bottom-6 w-24 h-5 rounded-full border border-museum-gold bg-museum-gold/5 animate-[ring-pulse_3s_infinite] pointer-events-none" />

                {/* Pedestal base stand */}
                <div className="w-24 h-8 border-t border-x border-white/25 bg-gradient-to-b from-museum-charcoal to-museum-void rounded-t flex items-center justify-center shadow-lg">
                  <div className="w-20 h-[1px] bg-white/10" />
                </div>

                {/* Interaction prompt key overlay badge */}
                <div className="absolute top-3 flex items-center gap-1.5 bg-museum-charcoal/90 border border-museum-gold/75 rounded-full px-2.5 py-0.5 text-xs font-semibold text-museum-gold shadow-md">
                  <span className="w-5 h-5 rounded bg-museum-gold/25 border border-museum-gold/75 flex items-center justify-center text-[10px] font-bold">
                    {isTouchDevice ? "X" : "E"}
                  </span>
                  <span className="text-[10px]">Interaksi</span>
                </div>
              </div>
            </div>

            {/* Slide 5: CTA/Penutup */}
            <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-6 md:px-12 text-center h-full animate-fade-in">
              <div className="w-16 h-22 border-t border-x border-museum-gold/30 rounded-t-lg bg-gradient-to-t from-museum-gold/5 to-museum-gold/15 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-museum-gold via-transparent to-transparent animate-pulse" />
                <div className="w-8 h-8 rounded-full bg-museum-gold/25 filter blur-sm animate-pulse" />
                <svg className="w-6 h-6 text-museum-gold absolute animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z" />
                </svg>
              </div>

              <h2 className="font-display text-2.5xl md:text-3.5xl tracking-wide text-museum-bone mb-3 leading-tight">
                Petualangan Dimulai Sekarang
              </h2>
              <p className="text-museum-mist text-sm leading-relaxed max-w-sm mb-4">
                Langkahkan kakimu, dengarkan pemandu suara, dan singkap setiap kisah yang tersembunyi di balik dinding galeri.
              </p>
            </div>
          </div>
        </div>

        {/* Footer controls: indicator + prev/next buttons */}
        <div className="px-6 py-4 bg-museum-charcoal/50 border-t border-white/5 flex items-center justify-between z-20">
          {/* Back button */}
          <button
            onClick={handleBack}
            className={`text-xs uppercase tracking-wider font-semibold py-2 px-4 rounded transition-colors ${
              activeSlide === 0
                ? "opacity-0 cursor-default pointer-events-none"
                : "text-museum-mist hover:text-museum-bone"
            }`}
            disabled={activeSlide === 0}
          >
            Kembali
          </button>

          {/* Dots Indicator */}
          <div className="flex gap-2.5">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  activeSlide === idx
                    ? "bg-museum-gold w-5"
                    : "bg-museum-stone hover:bg-museum-mist"
                }`}
                aria-label={`Ke slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Next / Start button */}
          <button
            onClick={handleNext}
            className="bg-museum-gold text-museum-void text-xs uppercase tracking-wider font-semibold py-2.5 px-5 rounded hover:bg-museum-gold/90 border border-museum-gold hover:border-museum-gold shadow-lg shadow-museum-gold/5 transition-all"
          >
            {activeSlide === totalSlides - 1 ? "Mulai Jelajahi" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
