/*!
 * Module B
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * The module's HTTP endpoint: serves the bundled web/ directory on the port
 * from the module's configuration (smi.server.port). `npm run server` runs
 * it; the integration and e2e tiers run against instances started this way by
 * scripts/servers.js, not against code hosted inside the test runner.
 * Standard library only (node:http) - no web server dependency.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.ts';

export const WEB_DIR: string = fileURLToPath(
    new URL('../web', import.meta.url),
);
export const HOST = '127.0.0.1';

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};

/**
 * Maps a request URL to a file under web/ (`/` -> `index.html`); `undefined`
 * for anything that would escape the directory.
 */
export function resolveWebFile(requestUrl: string): string | undefined {
    const pathname = decodeURIComponent(
        new URL(requestUrl, 'http://localhost').pathname,
    );
    const relative = pathname.endsWith('/')
        ? pathname + 'index.html'
        : pathname;
    const resolved = path.resolve(WEB_DIR, '.' + relative);
    return resolved.startsWith(WEB_DIR + path.sep) ? resolved : undefined;
}

export function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
): void {
    const file = resolveWebFile(request.url ?? '/');
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
        response.writeHead(200, {
            'Content-Type':
                CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        });
        fs.createReadStream(file).pipe(response);
        return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
}

export function createServer(): http.Server {
    return http.createServer(handle);
}

/**
 * Starts the instance with the configuration resolved from `argv`, the
 * environment and the bundled resources.
 */
export function serve(
    argv: readonly string[] = process.argv.slice(2),
): http.Server {
    const application = config(argv);
    const port = Number(application.get('smi.server.port'));
    const server = createServer();
    server.listen(port, HOST, () => {
        console.log(
            `demo-module-b serving ${WEB_DIR} on http://${HOST}:${port}/ (profiles ${application.profiles.join(',')}, log level ${application.get('smi.log.level')})`,
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
