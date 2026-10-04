/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

/**
 * The module's HTTP endpoint: serves the bundled web/ directory - the example
 * pages and the JSON-CL resources they load (web/pages/*.json), as a backend
 * serves them; a page opened from file:// is not allowed to read them - on
 * the port from the module's configuration (smi.server.port). `npm run
 * server` runs it; the integration and e2e tiers run against instances
 * started this way by scripts/servers.js, not against code hosted inside the
 * test runner. Standard library only (node:http) - no web server dependency.
 *
 * It listens on every interface by default (smi.server.host: 0.0.0.0), so a
 * browser on a remote Selenium Grid node can reach the pages - the setmy.info
 * e2e standard; `SMI_SERVER_HOST=127.0.0.1` keeps it on this machine.
 * @module server
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";

export const WEB_DIR = fileURLToPath(new URL("../web", import.meta.url));

const CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
};

/**
 * Maps a request URL to a file under web/ (`/` -> `index.html`); `undefined`
 * for anything that would escape the directory, and for a URL that cannot be
 * decoded (a malformed percent-encoding such as `/%`).
 * @param {string} requestUrl
 * @returns {string | undefined}
 */
export function resolveWebFile(requestUrl) {
    let pathname;
    try {
        pathname = decodeURIComponent(
            new URL(requestUrl, "http://localhost").pathname,
        );
    } catch {
        return undefined;
    }
    const relative = pathname.endsWith("/")
        ? pathname + "index.html"
        : pathname;
    const resolved = path.resolve(WEB_DIR, "." + relative);
    return resolved.startsWith(WEB_DIR + path.sep) ? resolved : undefined;
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
export function handle(request, response) {
    const file = resolveWebFile(request.url ?? "/");
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
        response.writeHead(200, {
            "Content-Type":
                CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
        });
        fs.createReadStream(file).pipe(response);
        return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
}

/** @returns {http.Server} */
export function createServer() {
    return http.createServer(handle);
}

/**
 * Starts the instance with the configuration resolved from `argv`, the
 * environment and the bundled resources.
 * @param {string[]} [argv]
 * @returns {http.Server}
 */
export function serve(argv = process.argv.slice(2)) {
    const application = config(argv);
    const host = String(application.get("smi.server.host", "127.0.0.1"));
    const port = Number(application.get("smi.server.port"));
    const server = createServer();
    server.listen(port, host, () => {
        const shown = host === "0.0.0.0" ? "127.0.0.1" : host;
        console.log(
            `cl-json-js serving ${WEB_DIR} on http://${shown}:${port}/ (profiles ${application.profiles.join(",")}, log level ${application.get("smi.log.level")})`,
        );
    });
    return server;
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    serve();
}
