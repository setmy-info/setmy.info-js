import globals from "globals";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
  {
    ignores: ["**/dist/**", "**/site/**", "**/*.tgz"],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
    },
  },
  // SpotBugs/FindBugs-analogue: heuristic security checks (unsafe regex,
  // eval, non-literal fs paths, etc.), all "warn" severity on purpose - a
  // gating "lint" step failing the build on a heuristic false positive
  // would be worse than the bug it's trying to catch. Findings still show
  // up in `npm run lint` output and in the site's lint report
  // (tools/lint-report.js). Applies to both JS and TS.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts"],
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      // Fires on virtually every path.join()-built fs call in this
      // codebase (internally-computed paths, not user input) - disabled
      // as pure noise; see README.md for the false-positive count with it
      // enabled. The other 13 security rules stay on.
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  // TypeScript is opt-in per module (a module only has .ts files if it
  // chose to); this block only ever matches files in a module that opted
  // in, so JS-only modules are completely unaffected.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  })),
];
