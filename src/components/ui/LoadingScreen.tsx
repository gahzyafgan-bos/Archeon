import { useMuseumStore } from "@/store/useMuseumStore";
import { CreditLine } from "./CreditLine";

export function LoadingScreen() {
  const isLoading = useMuseumStore((s) => s.isLoading);
  const progress = useMuseumStore((s) => s.loadProgress);
  const loadError = useMuseumStore((s) => s.loadError);
  const finishLoading = useMuseumStore((s) => s.finishLoading);
  const setLoadError = useMuseumStore((s) => s.setLoadError);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-museum-void">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Minimalist mark standing in for the museum logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 border border-museum-gold/60 rotate-45 flex items-center justify-center">
            <div className="w-6 h-6 border border-museum-gold/80 rotate-45" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl tracking-[0.2em] text-museum-bone text-center">
            MUSEUM MPU TANTULAR
          </h1>
          <p className="text-museum-mist text-xs tracking-[0.3em] uppercase">Virtual Experience</p>
        </div>

        <div className="w-64 md:w-80 flex flex-col gap-2 mt-4">
          <div className="h-[2px] w-full bg-museum-stone/60 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ease-museum ${
                loadError ? "bg-museum-mist/50" : "bg-museum-gold"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-museum-mist tracking-widest uppercase">
            <span>{loadError ? "Terhenti" : "Menyiapkan galeri"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* The way out of a load that cannot finish.
            Two choices rather than one, because they answer different
            situations: a connection that dropped and came back is fixed by
            reloading, while a single asset that will never arrive is best
            walked past — every artifact already degrades to a placeholder on
            its own (ModelErrorBoundary), so continuing costs the visitor one
            object, not the museum. Doing nothing was the previous behaviour
            and it cost them everything. */}
        {loadError && (
          <div className="mt-6 flex flex-col items-center gap-4 max-w-xs text-center animate-fade-in">
            <p className="text-museum-mist text-xs leading-relaxed">
              {loadError === "failed"
                ? "Sebagian isi museum gagal diunduh. Biasanya karena koneksi terputus sesaat."
                : "Unduhan berhenti bergerak. Periksa koneksi internet Anda, lalu coba lagi."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => window.location.reload()}
                className="rounded-full bg-museum-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-museum-void border border-museum-gold hover:bg-museum-gold/90 transition-colors"
              >
                Coba Lagi
              </button>
              <button
                onClick={() => {
                  setLoadError(null);
                  finishLoading();
                }}
                className="rounded-full border border-white/20 px-5 py-2.5 text-xs uppercase tracking-wider text-museum-mist hover:text-museum-bone hover:border-museum-gold/50 transition-colors"
              >
                Lanjutkan Saja
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Credit sits at the foot of the screen, where a waiting visitor's eye
          has somewhere to land, and well clear of the museum's own name. */}
      <CreditLine
        className="absolute inset-x-0 animate-fade-in"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      />
    </div>
  );
}
