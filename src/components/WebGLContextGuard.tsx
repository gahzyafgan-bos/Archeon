import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Turns a lost GPU context from a permanent black screen into something the
 * visitor can see and act on.
 *
 * Two things have to happen, and the app previously did neither:
 *
 *  1. **`preventDefault()` on `webglcontextlost`.** This is not a formality.
 *     The WebGL spec says the browser will only ever fire
 *     `webglcontextrestored` if the page cancelled the loss event first;
 *     without it the context is gone for good and no amount of waiting brings
 *     it back. The audit measured exactly that shape: 20 × "THREE.WebGLRenderer:
 *     Context Lost." and `webglcontextrestored` fired zero times.
 *
 *  2. **Tell the visitor.** The canvas going black is invisible to every layer
 *     above it — the DOM HUD carries on drawing buttons over a dead scene, so
 *     the app looks like it is working while showing nothing at all. Someone
 *     standing in a museum has no way to interpret that.
 *
 * Mounted inside the Canvas because `gl.domElement` is the only element that
 * receives these events, and the renderer only exists in here.
 */
export function WebGLContextGuard() {
  const gl = useThree((s) => s.gl);
  const setRendererLost = useMuseumStore((s) => s.setRendererLost);

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (event: Event) => {
      // Ask the browser to keep the door open for a restore.
      event.preventDefault();
      setRendererLost(true);
    };

    const onRestored = () => {
      // three rebuilds its GPU-side state on the next render by itself; what
      // it cannot do is know that we were showing a message over the top.
      setRendererLost(false);
    };

    canvas.addEventListener("webglcontextlost", onLost as EventListener);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      // A guard that outlives its canvas must not leave the app stuck behind
      // the "context lost" screen.
      setRendererLost(false);
    };
  }, [gl, setRendererLost]);

  return null;
}
