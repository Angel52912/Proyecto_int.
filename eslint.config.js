import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "front/js/vendor/**", "back/supabase/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["front/js/**/*.js", "front/sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.serviceworker, L: "readonly", supabase: "readonly" },
    },
    rules: {
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Usa textContent o crea elementos con el DOM. Nunca HTML crudo." },
        { property: "outerHTML", message: "Usa textContent o crea elementos con el DOM. Nunca HTML crudo." },
        { property: "insertAdjacentHTML", message: "Usa textContent o crea elementos con el DOM. Nunca HTML crudo." },
      ],
    },
  },
  {
    files: [
      "front/tests/**/*.js",
      "back/tests/**/*.js",
      "jest.config.js",
      "eslint.config.js",
      "scripts/**/*.mjs",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.jest, ...globals.browser },
    },
  },
];
