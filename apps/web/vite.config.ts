import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const configuredBase = process.env.VITE_BASE_PATH?.trim();

export default defineConfig(({ mode }) => ({
  base: configuredBase || "/",
  plugins: [
    react(),
    ...(mode === "analyze"
      ? [visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true, open: false, emitFile: false })]
      : [])
  ],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true
      }
    }
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
