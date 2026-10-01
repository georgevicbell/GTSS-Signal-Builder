import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "html", "json-summary", "json"],
      include: ["src/**/*.ts", "store/**/*.ts", "schema/**/*.ts"],
    },
  },
});
