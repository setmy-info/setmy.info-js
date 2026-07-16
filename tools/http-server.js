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
    console.error(`HTTP server for port ${port} is already registered.`);
    process.exit(1);
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
    const requestPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const normalizedPath = path.normalize(decodeURIComponent(requestPath)).replace(/^[\\/]+/, "");
    const filePath = path.resolve(directory, normalizedPath);

    if (!filePath.startsWith(directory)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        const indexFilePath = path.join(filePath, "index.html");

        if (fs.existsSync(indexFilePath) && fs.statSync(indexFilePath).isFile()) {
          response.writeHead(200, { "Content-Type": getContentType(indexFilePath) });
          fs.createReadStream(indexFilePath).pipe(response);
          return;
        }

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(renderDirectoryListing(requestUrl.pathname, filePath));
        return;
      }

      response.writeHead(200, { "Content-Type": getContentType(filePath) });
      fs.createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
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
      const href = new URL(`${encodeURIComponent(entry.name)}${suffix}`, `http://127.0.0.1${ensureTrailingSlash(requestPath)}`).pathname;

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

function getContentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

function printUsageAndExit(code = 1) {
  console.error(
    "Usage: node ./tools/http-server.js [start|stop] [--port <port>] [--directory <directory>]",
  );
  process.exit(code);
}