import { Component, type ErrorInfo, type ReactNode } from "react";
import { FatalErrorScreen } from "./FatalErrorScreen";

/**
 * Last line of defence for the whole application.
 *
 * There was exactly one error boundary in this codebase before — the per-model
 * one in ArtifactMesh — and it does its job well: a `.glb` that 404s degrades
 * to a placeholder and the museum keeps running (verified in the audit). But it
 * only covers what is inside one artifact. Anything thrown above it took the
 * entire tree down, and React's default behaviour on an unhandled render error
 * is to unmount everything: `<div id="root">` ends up empty, and the visitor
 * sees a white page with no text on it at all.
 *
 * That is what a device without WebGL got. It is also what any future bug in
 * the store, the room config or the loader would get. A blank page is the worst
 * possible failure mode for a public kiosk, because it gives the visitor no
 * information and no next step — they conclude the museum's website is broken
 * and leave.
 *
 * Deliberately placed OUTSIDE the Canvas and outside every feature component,
 * so it can still render when three, the GPU, or the scene graph is the thing
 * that failed.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always logged, in production too: this branch means the visitor is
    // looking at an error screen, and the one thing that makes that
    // investigable later is the stack that caused it. Unlike the per-model
    // success logs, this is not chatter — it fires at most once per session.
    console.error("[museum] gagal total, menampilkan layar kesalahan.", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <FatalErrorScreen
        title="Museum virtual tidak bisa ditampilkan"
        body={
          <>
            Terjadi kesalahan yang membuat tampilan 3 dimensi berhenti. Ini biasanya
            sementara — memuat ulang halaman sudah cukup untuk sebagian besar kasus.
          </>
        }
        hint="Kalau setelah dimuat ulang tetap sama, coba tutup aplikasi lain yang sedang terbuka, atau buka museum ini lewat perangkat lain."
      />
    );
  }
}
