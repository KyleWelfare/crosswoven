import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /jump-tuner/ path.
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
