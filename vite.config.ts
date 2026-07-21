import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // basicSsl serves the dev server over HTTPS with a self-signed cert. This is
  // REQUIRED for testing Mode VR on a phone over the LAN: mobile browsers only
  // expose the gyroscope (`DeviceOrientationEvent`) on a secure context, so
  // over plain HTTP the sensor — and therefore VR mode — silently never works.
  // On the phone you'll get a one-time "connection not private" warning for the
  // self-signed cert; tap Advanced → Proceed once and the sensor becomes
  // available. Production hosting is HTTPS already, so this only affects dev.
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["afgan.edufund.biz.id", "localhost"]
  },
  assetsInclude: ["**/*.glb", "**/*.gltf"],
});
