/*!
 * Module C
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

import { fileURLToPath } from "node:url";
import { Application } from "@setmy-info/commons";

/**
 * The bundled configuration directory - resolved from this file, so it is the
 * same directory whether this runs from src/ or from the built dist/.
 */
export const RESOURCES_DIR = fileURLToPath(
    new URL("../resources", import.meta.url),
);

/**
 * The module's configuration: bundled `resources/` first, then the `SMI_*`
 * environment and the `--smi-*` options in `argv` (none by default) -
 * profile, environment and CLI overrides included, see `@setmy-info/commons`.
 * @param {string[]} [argv]
 * @param {object} [options] passed through to `Application`
 * @returns {Application}
 */
export function config(argv = [], options = {}) {
    return new Application(argv, { configPaths: [RESOURCES_DIR], ...options });
}
