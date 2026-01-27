// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals"; // standard globals

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      // FIX 1: Add browser and node globals so 'console' and 'window' are defined
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      "obsidianmd/sample-names": "off",
      "obsidianmd/prefer-file-manager-trash-file": "error",
      
      // OPTIONAL: If 'console' still complains after adding globals, you can turn it off:
      // "no-console": "off",
    },
  },
]);