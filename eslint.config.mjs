import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.ts"] },
  
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-unused-vars": "off"
    },
  },
  
  { ignores: ["main.js", "node_modules/", "dist/"] }
];