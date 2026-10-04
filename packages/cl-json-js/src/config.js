/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
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
 * The browser library itself (`index.js`) has no configuration; this is the
 * running instance's (`server.js`).
 * @param {string[]} [argv]
 * @param {object} [options] passed through to `Application`
 * @returns {Application}
 */
export function config(argv = [], options = {}) {
    return new Application(argv, { configPaths: [RESOURCES_DIR], ...options });
}
