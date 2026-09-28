import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The pre-game article routes, retired 2026-09-28. Kept in git so the wipe is
    // reversible; they are not part of the app any more, so they are not linted.
    "_archive/**",
  ]),
]);

export default eslintConfig;
