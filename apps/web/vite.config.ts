import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configuredBase = process.env.VITE_BASE_PATH?.trim();

export default defineConfig({
  base: configuredBase || "/",
  plugins: [react()]
});
