import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false, // comparten sesión/cookie de fixtures — misma lección que Forma (QA regresión web)
  },
});
