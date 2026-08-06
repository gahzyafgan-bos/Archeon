import type { ReactNode } from "react";
import { CreditLine } from "./CreditLine";

/**
 * The one screen a visitor sees when the 3D view cannot run.
 *
 * It exists because of what the audit measured, not as a nicety: with no
 * WebGL context the whole React tree unmounted and `<div id="root">` was left
 * literally empty, and after a lost context the canvas went black while the
 * DOM HUD kept floating over nothing. Both read to a visitor as "the website is
 * broken", and neither offered a single thing to do next.
 *
 * Three rules this screen follows, all learned from those two failures:
 *
 *  1. **It never needs WebGL.** Plain DOM and CSS only. A fallback that itself
 *     depends on the thing that just failed is not a fallback.
 *  2. **It says what happened in the visitor's own terms** — not "WebGL context
 *     lost", which means nothing to someone standing in a museum.
 *  3. **It always offers an action.** Even when the honest answer is "try a
 *     different phone", reloading is offered, because a lost context very often
 *     comes back on a fresh page.
 */
export function FatalErrorScreen({
  title,
  body,
  hint,
  actionLabel = "Muat Ulang Halaman",
  onAction = () => window.location.reload(),
}: {
  title: string;
  body: ReactNode;
  hint?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-museum-void px-6 text-center">
      {/* Same diamond mark as the loading screen, so this reads as the same
          application having a problem rather than a browser error page. */}
      <div className="w-14 h-14 border border-museum-gold/50 rotate-45 flex items-center justify-center">
        <div className="w-6 h-6 border border-museum-gold/70 rotate-45" />
      </div>

      <div className="flex flex-col items-center gap-3 max-w-md">
        <h1 className="font-display text-2xl text-museum-bone tracking-wide">{title}</h1>
        <div className="text-museum-mist text-sm leading-relaxed">{body}</div>
      </div>

      <button
        onClick={onAction}
        className="rounded-full bg-museum-gold px-6 py-3 text-sm font-semibold text-museum-void border border-museum-gold hover:bg-museum-gold/90 transition-colors"
      >
        {actionLabel}
      </button>

      {hint && (
        <p className="text-museum-mist/60 text-xs leading-relaxed max-w-sm">{hint}</p>
      )}

      <CreditLine
        className="absolute inset-x-0"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      />
    </div>
  );
}

/**
 * Does this browser/device actually have a WebGL context to give us?
 *
 * Checked BEFORE mounting the Canvas rather than caught afterwards, because
 * three throws from inside the renderer constructor and an error boundary can
 * only report that after React has already torn the tree down. Asking first
 * means the visitor gets the explanation instead of a blank page.
 *
 * The probe canvas is thrown away immediately — holding onto it would occupy
 * one of the handful of simultaneous WebGL contexts a mobile browser allows,
 * which is exactly the resource the real scene needs.
 */
export function detectWebGLSupport(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Release it right away; some drivers keep the context alive otherwise.
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
