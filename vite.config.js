import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    manifest: "asset-manifest.json",
  },
  plugins: [react()],
});
