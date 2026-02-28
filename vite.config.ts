import { defineConfig } from "vite";

export default defineConfig({
  root: "src/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3578",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3578",
      },
    },
  },
});
