// E2E page helper - the setmy.info e2e standard, ported from setmy-info-less's
// scripts/pageHelper.cjs (and angular-start-project's test/e2e/pageHelper.js):
// selenium-webdriver against an EXTERNAL, already running Selenium Grid or
// standalone server, Firefox as the baseline browser, headless by default, a
// fixed 2000x1200 viewport, one fresh browser session per rendered page and
// bounded cleanup, and the same VERIFICATION PRINCIPLE: elementIs() /
// elementIdIs() snapshot concrete computed values (getComputedStyle +
// getBoundingClientRect) to assert on - not mere element existence.
//
// Differences from the LESS original:
//   - the page comes from the package's RUNNING INSTANCE, started by the
//     pre-e2e-test lifecycle phase (scripts/servers.js) - the "lifecycle slot"
//     the LESS guide reserves for when page serving moves out of pageHelper -
//     so there is no per-file express server. The package is inferred from the
//     calling test file (packages/<package>/...), its port read the way the
//     instance reads it (scripts/servers.js modulePort);
//   - pageIsRendered(url) also takes an explicit URL, e.g. a file:// one;
//   - ES module, node:test (this repo's runner) - no jest `expect` here, the
//     specs and scripts/gherkin assert with node:assert.
//
//     SELENIUM_HUB_URL   default http://localhost:4444/wd/hub (a local standalone grid;
//                        the shared grid: http://selenium.gintra:4444/wd/hub)
//     SELENIUM_BROWSER   default firefox
//     SELENIUM_HEADLESS  default true; false / 0 / no / off for a visible browser
//     E2E_PAGE_HOST      host the BROWSER reaches the instance at; default: loopback for a
//                        grid on this machine, else this machine's address on the route
//                        toward the hub (the instance must listen there - cl-json-js does)
//     APP_BASE_URL       the whole base URL; overrides E2E_PAGE_HOST and the port
import dgram from "node:dgram";
import os from "node:os";

import { Builder, By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

import { modulePort } from "./servers.js";

const SELENIUM_HUB_URL =
    process.env.SELENIUM_HUB_URL || "http://localhost:4444/wd/hub";
const BROWSER = process.env.SELENIUM_BROWSER || "firefox";
const HEADLESS = !/^(false|0|no|off)$/i.test(
    process.env.SELENIUM_HEADLESS ?? "true",
);
const PAGE_HOST = process.env.E2E_PAGE_HOST || "";
const WINDOW_WIDTH = 2000;
const WINDOW_HEIGHT = 1200;
const WAIT_MS = Number(process.env.E2E_WAIT_MS) || 10000;
const QUIT_TIMEOUT_MS = Number(process.env.SELENIUM_QUIT_TIMEOUT_MS) || 15000;

/** Shared state: driver, page name, URL, the last computed-style snapshot. */
export const data = {};

// Race a promise against a timeout so a stuck quit() can never hang after().
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
            console.warn(
                `pageHelper: ${label} did not finish within ${ms}ms - continuing.`,
            );
            resolve(false);
        }, ms);
    });
    return Promise.race([
        Promise.resolve(promise).then(
            () => true,
            (error) => {
                console.warn(
                    `pageHelper: ${label} failed: ${error?.message ?? error}`,
                );
                return true;
            },
        ),
        timeout,
    ]).finally(() => clearTimeout(timer));
}

// ------------------------------------------------------- page and address

/** Sets the page (<name>.html) the next pageIsRendered() opens. */
export function pageName(name) {
    data.name = name;
}

/**
 * The package a test file belongs to, from a stack trace or file URL that
 * passes through packages/<package>/.
 * @param {string} stack
 * @returns {string}
 */
export function packageNameFromStack(stack) {
    const match = /[\\/]packages[\\/]([^\\/]+)[\\/](?:test|src)[\\/]/.exec(
        decodeURIComponent(stack),
    );
    if (!match) {
        throw new Error(
            "pageHelper: cannot infer the package - call it from packages/<package>/test/...",
        );
    }
    return match[1];
}

// node --test runs every test file in its own process with the file as
// argv[1] (jest's testPath in the LESS original); the stack covers a direct call.
function inferPackageName() {
    return packageNameFromStack(
        `${new Error().stack ?? ""}\n${process.argv[1] ?? ""}`,
    );
}

function hubHostname() {
    try {
        return new URL(SELENIUM_HUB_URL).hostname;
    } catch {
        return "localhost";
    }
}

export function isLoopbackHost(host) {
    return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "[::1]"
    );
}

// First non-internal IPv4 of this machine, preferring a real LAN interface: a
// container bridge (docker0) is up but routes nowhere useful for a grid node.
export function firstExternalIPv4() {
    const candidates = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        for (const address of addresses ?? []) {
            if (address.family === "IPv4" && !address.internal) {
                candidates.push({ name, address: address.address });
            }
        }
    }
    const lan = candidates.find(
        (candidate) =>
            !/^(docker|br-|veth|virbr|podman|cni)/.test(candidate.name),
    );
    return (lan ?? candidates[0])?.address ?? "localhost";
}

// The local address on the route toward `host` - what the grid node must call
// back on. connect() on a UDP socket only selects the route, it sends nothing,
// so this answers even while the grid itself is down.
function localAddressToward(host) {
    return new Promise((resolve) => {
        let socket;
        const fallback = () => {
            try {
                socket?.close();
            } catch {
                // already closed
            }
            resolve(firstExternalIPv4());
        };
        try {
            socket = dgram.createSocket("udp4");
        } catch {
            resolve(firstExternalIPv4());
            return;
        }
        socket.once("error", fallback);
        try {
            socket.connect(53, host, () => {
                let address;
                try {
                    address = socket.address().address;
                } catch {
                    address = undefined;
                }
                socket.close();
                resolve(
                    address && address !== "0.0.0.0"
                        ? address
                        : firstExternalIPv4(),
                );
            });
        } catch {
            fallback();
        }
    });
}

/** The host the browser reaches this machine at. */
export async function resolvePageHost() {
    if (PAGE_HOST) {
        return PAGE_HOST;
    }
    // A grid on this machine reaches the instance over loopback - no interface
    // guessing, and it works on a laptop with no network at all.
    if (isLoopbackHost(hubHostname())) {
        return "127.0.0.1";
    }
    return localAddressToward(hubHostname());
}

/** Base URL of the calling package's running instance. */
export async function baseUrl(packageName = inferPackageName()) {
    if (process.env.APP_BASE_URL) {
        return process.env.APP_BASE_URL.replace(/\/$/, "");
    }
    return `http://${await resolvePageHost()}:${await modulePort(packageName)}`;
}

/** The URL of the current page name: <base>/<name>.html. */
export function getPath() {
    data.url = `${data.baseUrl}/${data.name || "index"}.html`;
    return data.url;
}

/** Whether the grid's browser runs on this machine (it can open file:// pages here). */
export function isLocalGrid() {
    return isLoopbackHost(hubHostname());
}

// ----------------------------------------------------------- the browser

// Outer window size so that the INNER viewport is exactly width x height.
export async function setViewport(width, height) {
    await data.driver.manage().window().setRect({ width, height });
    const viewport = await data.driver.executeScript(
        "return { w: window.innerWidth, h: window.innerHeight };",
    );
    const wDiff = width - viewport.w;
    const hDiff = height - viewport.h;
    if (wDiff !== 0 || hDiff !== 0) {
        await data.driver
            .manage()
            .window()
            .setRect({ width: width + wDiff, height: height + hDiff });
    }
}

async function startSession(preferences = {}) {
    const options = new firefox.Options();
    if (HEADLESS) {
        options.addArguments("-headless");
    }
    for (const [name, value] of Object.entries(preferences)) {
        options.setPreference(name, value);
    }
    data.driver = await new Builder()
        .usingServer(SELENIUM_HUB_URL)
        .forBrowser(BROWSER)
        .setFirefoxOptions(options)
        .build();
    await data.driver.manage().setTimeouts({ pageLoad: 30000, implicit: 0 });
    await data.driver.get("about:blank");
    await setViewport(WINDOW_WIDTH, WINDOW_HEIGHT);
}

/**
 * A fresh browser session on the current page name (or on `url`) - its own
 * profile, so storage and state start clean - once the document is loaded.
 * Closes a previous session first. Content a page renders asynchronously is
 * waited for by the spec (waitFor, waitForText).
 * @param {string} [url] Explicit URL instead of getPath().
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.preferences] Firefox preferences for
 *     this session (geckodriver's defaults differ from a desktop Firefox's:
 *     security.fileuri.strict_origin_policy, for one, is off).
 */
export async function pageIsRendered(url, { preferences } = {}) {
    // Defensive: a session left open by a failed scenario would leak and count
    // against the grid's max-session cap.
    await pageClose();
    if (url) {
        data.url = url;
    } else {
        data.baseUrl = await baseUrl(inferPackageName());
        getPath();
    }
    await startSession(preferences);
    await data.driver.get(data.url);
    await waitUntil(
        "return document.readyState === 'complete';",
        `page ${data.url} did not load`,
    );
}

export async function pageClose() {
    if (data.driver) {
        await withTimeout(data.driver.quit(), QUIT_TIMEOUT_MS, "driver.quit()");
        data.driver = null;
    }
}

// --------------------------------------------------------------- elements

export function getTitle() {
    return data.driver.getTitle();
}

export async function waitFor(selector) {
    await data.driver.wait(
        until.elementLocated(By.css(selector)),
        WAIT_MS,
        `element not found: ${selector}`,
    );
    return data.driver.findElement(By.css(selector));
}

/** Wait until the script (evaluated in the page) returns truthy. */
export async function waitUntil(script, label, ...args) {
    await data.driver.wait(
        async () => data.driver.executeScript(script, ...args),
        WAIT_MS,
        label || `condition did not become true: ${script}`,
    );
}

/** textContent of the first match, or null. */
export function getText(selector) {
    return data.driver.executeScript(
        "var el = document.querySelector(arguments[0]);" +
            "return el ? el.textContent : null;",
        selector,
    );
}

/** Trimmed textContent of every match. */
export function getTexts(selector) {
    return data.driver.executeScript(
        "return Array.prototype.map.call(document.querySelectorAll(arguments[0])," +
            " function (el) { return el.textContent.trim(); });",
        selector,
    );
}

/**
 * Waits until the text of `selector` contains `expected` (a string) or
 * matches it (a RegExp) - content renders asynchronously.
 */
export async function waitForText(selector, expected) {
    let last = null;
    const matches = (text) =>
        text !== null &&
        (expected instanceof RegExp
            ? expected.test(text)
            : text.includes(expected));
    await data.driver
        .wait(async () => matches((last = await getText(selector))), WAIT_MS)
        .catch(() => {
            throw new Error(
                `${selector}: text ${JSON.stringify(last)} does not contain ${expected}`,
            );
        });
    return last;
}

export function getAttribute(selector, name) {
    return data.driver.executeScript(
        "var el = document.querySelector(arguments[0]);" +
            "return el ? el.getAttribute(arguments[1]) : null;",
        selector,
        name,
    );
}

export async function countOf(selector) {
    return (await data.driver.findElements(By.css(selector))).length;
}

export function run(script, ...args) {
    return data.driver.executeScript(script, ...args);
}

/** Click an element and order the next command after its handlers. */
export async function clickElement(selector) {
    await (await waitFor(selector)).click();
    await data.driver.executeScript("return document.readyState;");
}

export function clickElementId(elementId) {
    return clickElement(`#${elementId}`);
}

/** Click the <button> under `scope` whose text is exactly `label`. */
export async function clickButton(label, scope = "body") {
    await waitFor(`${scope} button`);
    for (const element of await data.driver.findElements(
        By.css(`${scope} button`),
    )) {
        if ((await element.getText()) === label) {
            await element.click();
            await data.driver.executeScript("return document.readyState;");
            return;
        }
    }
    throw new Error(`no button "${label}" in ${scope}`);
}

/** Types into an element ("" is Enter). */
export async function typeInto(selector, text) {
    await (await waitFor(selector)).sendKeys(text);
}

/**
 * The computed-value snapshot of the first element matching `selector`, in
 * data.computedStyles: box model, font, geometry, colors, and every computed
 * longhand in allStyles (shorthands are absent - assert longhands).
 */
export async function elementIs(selector) {
    data.computedStyles = await data.driver.executeScript(
        "var el = document.querySelector(arguments[0]);" +
            "if (!el) return null;" +
            "var style = window.getComputedStyle(el);" +
            "var rect = el.getBoundingClientRect();" +
            "var allStyles = {};" +
            "for (var i = 0; i < style.length; i++) { var p = style[i]; allStyles[p] = style.getPropertyValue(p); }" +
            "return {" +
            '  margin: style.marginTop + " " + style.marginRight + " " + style.marginBottom + " " + style.marginLeft,' +
            '  padding: style.paddingTop + " " + style.paddingRight + " " + style.paddingBottom + " " + style.paddingLeft,' +
            "  fontFamily: style.fontFamily," +
            "  fontSize: style.fontSize," +
            "  fontWeight: style.fontWeight," +
            "  x: Math.round(rect.x)," +
            "  y: Math.round(rect.y)," +
            "  top: Math.round(rect.top)," +
            "  left: Math.round(rect.left)," +
            "  width: Math.round(rect.width)," +
            "  height: Math.round(rect.height)," +
            "  backgroundColor: style.backgroundColor," +
            "  color: style.color," +
            "  allStyles: allStyles" +
            "};",
        selector,
    );
    if (!data.computedStyles) {
        throw new Error(`Element '${selector}' not found`);
    }
    return data.computedStyles;
}

export function elementIdIs(elementId) {
    return elementIs(`#${elementId}`);
}
