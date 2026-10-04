#!/usr/bin/env node
// The module's running instance: serves web/ over HTTP, as a backend serves
// the JSON-CL resources (web/pages/*.json) - a page opened from file:// is not
// allowed to read them by default. The port is `config.port` of this package's
// package.json (the library itself has no configuration and no dependencies);
// scripts/servers.js reads it the same way.
//
//     npm run server -w @setmy-info/cl-json-js      # http://127.0.0.1:48241/
//     PORT=8080 npm run server -w @setmy-info/cl-json-js
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const ROOT = path.join(PACKAGE_DIR, "web");
const PORT = Number(
    process.env.PORT ??
        JSON.parse(
            fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"),
        ).config.port,
);
// Every interface by default, so a browser on a remote Selenium Grid node can
// reach the pages (the setmy.info e2e standard, as setmy-info-less's
// pageHelper server); HOST=127.0.0.1 keeps it on this machine.
const HOST = process.env.HOST ?? "0.0.0.0";
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
};

http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.resolve(ROOT, relative || "index.html");
    if (!file.startsWith(ROOT + path.sep)) {
        response.writeHead(404).end();
        return;
    }
    fs.readFile(file, (error, body) => {
        if (error) {
            response
                .writeHead(404, { "content-type": "text/plain" })
                .end("Not found");
            return;
        }
        response
            .writeHead(200, {
                "content-type":
                    TYPES[path.extname(file)] ?? "application/octet-stream",
                "cache-control": "no-cache",
            })
            .end(body);
    });
}).listen(PORT, HOST, () => {
    console.log(
        `cl-json-js examples: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/`,
    );
});
