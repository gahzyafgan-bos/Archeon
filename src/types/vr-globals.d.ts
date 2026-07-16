/**
 * Non-standard/vendor-prefixed browser APIs used by VR Cardboard mode that
 * TypeScript's bundled lib.dom.d.ts doesn't (yet) describe.
 */

/** iOS 13+ Safari gates deviceorientation behind an explicit permission prompt. */
interface DeviceOrientationEventConstructorIOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

interface Window {
  DeviceOrientationEvent: typeof DeviceOrientationEvent & DeviceOrientationEventConstructorIOS;
}

/** `lock`/`unlock` are implemented by Chromium/Android but missing from lib.dom.d.ts. */
interface ScreenOrientation {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}
