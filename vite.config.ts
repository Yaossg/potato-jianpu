import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { audioLicenses } from "./scripts/audio-licenses.mjs";

export default defineConfig({
  plugins: [react(), audioLicenses()],
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
});

