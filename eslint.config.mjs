import globals from "globals";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
    {
        ignores: ["**/dist/**", "**/coverage/**", "reports/**", "build/**"],
    },
    {
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
        rules: {
            "no-unused-vars": "error",
            "no-undef": "error",
        },
    },
    // Heuristic security checks (unsafe regex, eval, non-literal fs paths,
    // etc.) - the static security analysis of this row, the Sobelow / ruff S
    // rules of the Elixir and Python siblings. "warn" severity on purpose:
    // a gating "lint" step failing the build on a heuristic false positive
    // would be worse than the bug it is trying to catch.
    {
        files: ["**/*.js", "**/*.mjs", "**/*.ts"],
        plugins: { security },
        rules: {
            ...security.configs.recommended.rules,
            // Reading a caller-supplied config path is commons' entire job,
            // and every path.join()-built fs call trips this - pure noise.
            "security/detect-non-literal-fs-filename": "off",
        },
    },
    // TypeScript is opt-in per module (module b); JS-only modules are unaffected.
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
