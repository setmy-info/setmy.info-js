#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { ensureDirectory, rootDir } from "./workspace-utils.js";

const toolPath = fileURLToPath(import.meta.url);
const invocation = parseInvocation(process.argv.slice(2));
const command = invocation.command;
const args = invocation.args;
const stateDirectory = path.join(rootDir, ".artifacts", "http-servers");

switch (command) {
    case "start":
        await startServer(args);
        break;
    case "stop":
        stopServer(args);
        break;
    case "serve":
        await serve(args);
        break;
    case "stop-all":
        stopAllServers();
        break;
    default:
        console.error(`Unknown command: ${command}`);
        printUsageAndExit(1);
}

function parseArgs(rawArgs) {
    const parsed = {};

    for (let index = 0; index < rawArgs.length; index += 1) {
        const token = rawArgs[index];

        if (!token.startsWith("--")) {
            console.error(`Unexpected argument: ${token}`);
            printUsageAndExit(1);
        }

        const key = token.slice(2);
        const value = rawArgs[index + 1];

        if (!value || value.startsWith("--")) {
            console.error(`Missing value for --${key}`);
            printUsageAndExit(1);
        }

        parsed[key] = value;
        index += 1;
    }

    return parsed;
}

function parseInvocation(argv) {
    if (argv.length === 0) {
        return {
            command: "start",
            args: {},
        };
    }

    if (argv[0].startsWith("--")) {
        return {
            command: "start",
            args: parseArgs(argv),
        };
    }

    return {
        command: argv[0],
        args: parseArgs(argv.slice(1)),
    };
}

function getWorkspaceServerConfig() {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const serverConfig = packageJson.config?.server;

    if (!serverConfig) {
        return null;
    }

    return {
        port: serverConfig.port,
        directory: serverConfig.directory
            ? path.resolve(process.cwd(), serverConfig.directory)
            : undefined,
    };
}

function getPort(rawPort) {
    const port = Number(rawPort);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${rawPort}`);
        process.exit(1);
    }

    return port;
}

function resolvePort(rawPort, serverConfig) {
    const port = rawPort ?? serverConfig?.port;

    if (!port) {
        console.error("Missing required option: --port");
        process.exit(1);
    }

    return getPort(port);
}

function getDirectory(rawDirectory) {
    if (!rawDirectory) {
        console.error("Missing required option: --directory");
        process.exit(1);
    }

    const directory = path.resolve(rawDirectory);

    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        console.error(`Directory does not exist: ${directory}`);
        process.exit(1);
    }

    return directory;
}

function resolveDirectory(rawDirectory, serverConfig) {
    return getDirectory(rawDirectory ?? serverConfig?.directory);
}

function getStateFile(port) {
    ensureDirectory(stateDirectory);
    return path.join(stateDirectory, `${port}.json`);
}

async function startServer(parsedArgs) {
    const serverConfig = getWorkspaceServerConfig();
    const port = resolvePort(parsedArgs.port, serverConfig);
    const directory = resolveDirectory(parsedArgs.directory, serverConfig);
    const stateFile = getStateFile(port);

    if (fs.existsSync(stateFile)) {
        const previous = JSON.parse(fs.readFileSync(stateFile, "utf8"));

        if (isProcessAlive(previous.pid)) {
            console.error(
                `HTTP server for port ${port} is already registered (pid ${previous.pid}). Stop it first: node tools/http-server.js stop --port ${port}`,
            );
            process.exit(1);
        }

        // Registration left behind by a run that died before its post-*
        // step (Ctrl-C, crashed test runner): the process is gone, so the
        // file is stale, not a conflict (report.md item 46).
        console.warn(
            `Discarding stale HTTP server registration for port ${port} (pid ${previous.pid} is not running)`,
        );
        fs.rmSync(stateFile, { force: true });
    }

    const child = spawn(
        process.execPath,
        [toolPath, "serve", "--port", String(port), "--directory", directory],
        {
            cwd: rootDir,
            detached: true,
            stdio: "ignore",
            env: process.env,
        },
    );

    child.unref();

    fs.writeFileSync(
        stateFile,
        JSON.stringify({ pid: child.pid, port, directory }, null, 2),
    );

    console.log(`Started HTTP server on port ${port} serving ${directory}`);
}

export function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
}

// Stops every server registered under .artifacts/http-servers/ - used by
// the root clean phase so a dirty state (leaked servers from an interrupted
// run) never blocks the next pre-integration-test.
export function stopAllServers() {
    if (!fs.existsSync(stateDirectory)) {
        return;
    }

    for (const entry of fs.readdirSync(stateDirectory)) {
        if (entry.endsWith(".json")) {
            stopServer({ port: entry.slice(0, -".json".length) });
        }
    }
}

function stopServer(parsedArgs) {
    const serverConfig = getWorkspaceServerConfig();
    const port = resolvePort(parsedArgs.port, serverConfig);
    const stateFile = getStateFile(port);

    if (!fs.existsSync(stateFile)) {
        console.log(`No HTTP server registered for port ${port}`);
        return;
    }

    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));

    try {
        process.kill(state.pid);
    } catch (error) {
        if (error.code !== "ESRCH") {
            throw error;
        }
    }

    fs.rmSync(stateFile, { force: true });
    console.log(`Stopped HTTP server on port ${port}`);
}

async function serve(parsedArgs) {
    const serverConfig = getWorkspaceServerConfig();
    const port = resolvePort(parsedArgs.port, serverConfig);
    const directory = resolveDirectory(parsedArgs.directory, serverConfig);

    const server = http.createServer((request, response) => {
        const requestUrl = new URL(
            request.url ?? "/",
            `http://${request.headers.host ?? "127.0.0.1"}`,
        );
        const requestPath =
            requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
        const normalizedPath = path
            .normalize(decodeURIComponent(requestPath))
            .replace(/^[\\/]+/, "");
        const filePath = path.resolve(directory, normalizedPath);

        // Boundary check with the separator appended: a bare
        // startsWith(directory) would also accept a SIBLING directory whose
        // name merely starts with the served one (/srv/web vs /srv/web-evil).
        if (
            filePath !== directory &&
            !filePath.startsWith(directory + path.sep)
        ) {
            response.writeHead(403);
            response.end("Forbidden");
            return;
        }

        try {
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                const indexFilePath = path.join(filePath, "index.html");

                if (
                    fs.existsSync(indexFilePath) &&
                    fs.statSync(indexFilePath).isFile()
                ) {
                    response.writeHead(200, {
                        "Content-Type": getContentType(indexFilePath),
                    });
                    fs.createReadStream(indexFilePath).pipe(response);
                    return;
                }

                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                });
                response.end(
                    renderDirectoryListing(requestUrl.pathname, filePath),
                );
                return;
            }

            response.writeHead(200, {
                "Content-Type": getContentType(filePath),
            });
            fs.createReadStream(filePath).pipe(response);
        } catch {
            response.writeHead(404, {
                "Content-Type": "text/html; charset=utf-8",
            });
            response.end(renderErrorPage(requestUrl.pathname));
        }
    });

    server.listen(port, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
}

function renderDirectoryListing(requestPath, directoryPath) {
    const entries = fs
        .readdirSync(directoryPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
            const suffix = entry.isDirectory() ? "/" : "";
            const href = new URL(
                `${encodeURIComponent(entry.name)}${suffix}`,
                `http://127.0.0.1${ensureTrailingSlash(requestPath)}`,
            ).pathname;

            return `<li><a href="${escapeHtml(href)}">${escapeHtml(entry.name)}${suffix}</a></li>`;
        })
        .join("\n");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Index of ${escapeHtml(requestPath)}</title>
  </head>
  <body>
    <h1>Index of ${escapeHtml(requestPath)}</h1>
    <ul>
${entries}
    </ul>
  </body>
</html>`;
}

function renderErrorPage(requestPath) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>404 Not Found</h1>
    <p>Directory or file was not found: ${escapeHtml(requestPath)}</p>
  </body>
</html>`;
}

function ensureTrailingSlash(value) {
    return value.endsWith("/") ? value : `${value}/`;
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// Extension -> MIME map covering what a browser module/asset pipeline
// actually serves (styles, images, fonts, source maps) - a stylesheet
// delivered as application/octet-stream is silently ignored by browsers,
// which matters once LESS/CSS and framework-app modules move in.
const contentTypeByExtension = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    return contentTypeByExtension[extension] ?? "application/octet-stream";
}

function printUsageAndExit(code = 1) {
    console.error(
        "Usage: node ./tools/http-server.js [start|stop|stop-all] [--port <port>] [--directory <directory>]",
    );
    process.exit(code);
}
