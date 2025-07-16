import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tsconfigPaths(),
    sentryVitePlugin({
      /* @ts-ignore */
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "atuin",
      project: "desktop-frontend",
      telemetry: false,
      debug: true,
    }),
    analyzer({
      analyzerMode: "static",
      enabled: !!process.env.ANALYZE,
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 100_000,
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. set port to 1420 but fail over to 1421 if it's in use to support running
  // a second instance with `--config" "backend/tauri-second-instance.conf.json`
  server: {
    hmr: false,
    port: 1420,
    strictPort: false,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  define: {
    "import.meta.vitest": "undefined",
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
}));
