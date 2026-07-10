import { useMuseumStore } from "@/store/useMuseumStore";

export function LoadingScreen() {
  const isLoading = useMuseumStore((s) => s.isLoading);
  const progress = useMuseumStore((s) => s.loadProgress);

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
              className="h-full bg-museum-gold transition-all duration-200 ease-museum"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-museum-mist tracking-widest uppercase">
            <span>Menyiapkan galeri</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
