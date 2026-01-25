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
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/ban-ts-comment": "off",

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      "no-console": ["error", { allow: ["warn", "error", "debug", "info"] }],
    },
  },
  
  { ignores: ["main.js", "node_modules/", "dist/"] }
];