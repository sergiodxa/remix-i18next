/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./config/vitest/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
