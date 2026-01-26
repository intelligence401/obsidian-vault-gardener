import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.ts"] },
  
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Typescript Strictness ---
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // --- Obsidian Plugin Best Practices ---
      "no-console": ["error", { allow: ["warn", "error", "info", "debug"] }],
      "no-debugger": "error",
      "no-var": "error",
      "prefer-const": "error",
      
      // Prevent usage of process.env (common Obsidian plugin rule)
      "no-process-env": "error",
    },
  },
  
  { ignores: ["main.js", "node_modules/", "dist/"] }
];