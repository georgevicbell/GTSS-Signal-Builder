import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
export default defineConfig([
  tseslint.configs.recommended,
  js.configs.recommended,
  {
    ignores: ["**/dist/**"],
    settings: {
      react: {
        version: "19.2.3", // Match this with your project's React version in package.json
      },
    },
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
]);
