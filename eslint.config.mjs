import globals from "globals";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
    {
        ignores: ["**/dist/**", "**/docs/**", "**/coverage/**", "**/*.tgz"],
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
    // Heuristic security checks (unsafe regex, eval, non-literal fs paths,
    // etc.), all "warn" severity on purpose - a gating "lint" step failing
    // the build on a heuristic false positive would be worse than the bug
    // it's trying to catch. Applies to both JS and TS.
    {
        files: ["**/*.js", "**/*.mjs", "**/*.ts"],
        plugins: { security },
        rules: {
            ...security.configs.recommended.rules,
            // Fires on virtually every path.join()-built fs call
            // (internally-computed paths, not user input) - disabled as pure
            // noise; the other 13 security rules stay on.
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
