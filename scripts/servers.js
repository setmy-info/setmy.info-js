#!/usr/bin/env node
// Starts and stops every demo module as a real running instance - THIS TEMPLATE'S
// implementation of the test lifecycle's pre and post steps. The generic side (the
// pre-integration-test / post-integration-test / pre-e2e-test / post-e2e-test
// phases the tiers and CI call) lives in scripts/lifecycle.js; this file is one
// step a project keeps, replaces or adds to there. Direct use:
//
//     node scripts/servers.js start
//     node scripts/servers.js stop        (idempotent)
//
// Each module starts as `node packages/<module>/src/server.{js,ts}` with this same
// node, detached in the background: pid in build/servers/<module>.pid, output in
// build/servers/<module>.log. `start` first stops whatever a previous aborted run
// left behind, then waits until every port answers. The port is read the way the
// module itself reads it (its src/config), so the SMI_PROFILES / SMI_* environment
// the instances start with is the one the tests see.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
export const STATE_DIR = path.join(ROOT_DIR, "build", "servers");
export const MODULES = ["a", "b", "c", "d"];
const HOST = "127.0.0.1";
const PORT_ATTEMPTS = 50;
const PORT_INTERVAL_MS = 200;

function sourceFile(module, baseName) {
    const sourceDir = path.join(ROOT_DIR, "packages", module, "src");
    return ["js", "ts"]
        .map((extension) => path.join(sourceDir, `${baseName}.${extension}`))
        .find((file) => fs.existsSync(file));
}

async function modulePort(module) {
    const { config } = await import(
        pathToFileURL(sourceFile(module, "config")).href
    );
    return Number(config().get("smi.server.port"));
}

function pidFile(module) {
    return path.join(STATE_DIR, `${module}.pid`);
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
}

function portOpen(port) {
    return new Promise((resolve) => {
        const socket = net.connect({ host: HOST, port });
        socket.setTimeout(PORT_INTERVAL_MS);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        const failed = () => {
            socket.destroy();
            resolve(false);
        };
        socket.once("error", failed);
        socket.once("timeout", failed);
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when every module has a pid file with a live process behind it. */
export function running() {
    return MODULES.every((module) => {
        const file = pidFile(module);
        return (
            fs.existsSync(file) &&
            pidAlive(Number(fs.readFileSync(file, "utf8").trim()))
        );
    });
}

export async function stop(module) {
    const file = pidFile(module);
    if (!fs.existsSync(file)) {
        console.log(
            `${module}: not running (no ${path.relative(ROOT_DIR, file)})`,
        );
        return;
    }
    const pid = Number(fs.readFileSync(file, "utf8").trim());
    try {
        process.kill(pid, "SIGTERM");
        for (
            let attempt = 0;
            attempt < PORT_ATTEMPTS && pidAlive(pid);
            attempt++
        ) {
            await sleep(PORT_INTERVAL_MS);
        }
        console.log(`${module}: stopped pid ${pid}`);
    } catch {
        console.log(`${module}: pid ${pid} already gone`);
    }
    fs.rmSync(file, { force: true });
}

export async function start(module) {
    const port = await modulePort(module);
    if (await portOpen(port)) {
        throw new Error(
            `${module}: port ${port} is already in use - a stray instance from elsewhere?`,
        );
    }
    const log = fs.openSync(path.join(STATE_DIR, `${module}.log`), "a");
    const child = spawn(process.execPath, [sourceFile(module, "server")], {
        cwd: ROOT_DIR,
        detached: true,
        stdio: ["ignore", log, log],
    });
    child.unref();
    fs.writeFileSync(pidFile(module), String(child.pid));
    for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt++) {
        if (child.exitCode !== null) {
            throw new Error(
                `${module}: exited with ${child.exitCode} before opening port ${port}`,
            );
        }
        if (await portOpen(port)) {
            console.log(
                `${module}: pid ${child.pid} listening on http://${HOST}:${port}/`,
            );
            return;
        }
        await sleep(PORT_INTERVAL_MS);
    }
    throw new Error(`${module}: did not open port ${port}`);
}

export async function stopAll() {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    for (const module of MODULES) {
        await stop(module);
    }
}

export async function startAll() {
    await stopAll();
    for (const module of MODULES) {
        await start(module);
    }
}

async function main(argv) {
    if (argv.length !== 1 || !["start", "stop"].includes(argv[0])) {
        throw new Error("Usage: node scripts/servers.js start|stop");
    }
    if (argv[0] === "start") {
        await startAll();
    } else {
        await stopAll();
    }
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
