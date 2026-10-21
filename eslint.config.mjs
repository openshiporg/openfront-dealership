import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Keystone resolver contexts are intentionally dynamic, and the inherited UI
    // predates React Compiler lint rules. As in the Openfront donors, report that
    // debt as warnings so lint stays executable and the findings stay visible.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react/no-children-prop": "warn",
    },
  },
  globalIgnores([
    ".keystone/**",
    ".next/**",
    ".runtime/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "schema.graphql",
  ]),
]);
