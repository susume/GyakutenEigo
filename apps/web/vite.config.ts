import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configuredBase = process.env.VITE_BASE_PATH?.trim();

export default defineConfig({
  base: configuredBase || "/",
  plugins: [react()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          socket: ["socket.io-client"]
        }
      }
    }
  }
});
