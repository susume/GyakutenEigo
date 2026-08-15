import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const configuredBase = process.env.VITE_BASE_PATH?.trim();
const localApiProxy = {
  "/api": "http://localhost:4000",
  "/socket.io": {
    target: "http://localhost:4000",
    ws: true
  }
};

export default defineConfig(({ mode }) => ({
  base: configuredBase || "/",
  plugins: [
    react(),
    ...(mode === "analyze"
      ? [visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true, open: false, emitFile: false })]
      : [])
  ],
  server: {
    proxy: localApiProxy
  },
  // Keep production-like `vite preview` tests same-origin while still using
  // the local Express server. This is a local-only proxy; GitHub Pages does
  // not run Vite and uses the Cloudflare Worker routes instead.
  preview: {
    proxy: localApiProxy
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          socket: ["socket.io-client"]
        }
      }
    }
  }
}));
