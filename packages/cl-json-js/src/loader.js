/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

// Loading JSON-CL resources - a backend's response or a file next to the
// page - and putting them into the DOM:
//
//     ClJson.include("cart", "pages/cart.json");                  // by hand
//     <script type="application/cl+json" src="pages/cart.json"     // or the way <script src> works
//             data-target="cart"></script>
//
// A page opened straight from disk (file://) can only read such files where
// the browser lets it: page JavaScript reading local files is refused by
// default (Firefox: security.fileuri.strict_origin_policy, Chrome:
// --allow-file-access-from-files) - unlike <script src> and <link href>, whose
// content the browser uses itself and never hands to the page. Over HTTP, as
// from a backend, it always works.

import { mount } from "./cl-sdui-interpreter.js";
import { ClJsonError } from "./core.js";

const FILE_HINT =
    " - the browser does not let a page opened from file:// read files: serve it over HTTP" +
    " (or, for local work only, allow it: Firefox security.fileuri.strict_origin_policy = false," +
    " Chrome --allow-file-access-from-files)";

/**
 * Loads a JSON resource.
 * @param {string} url Relative to the page.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch] Default `globalThis.fetch`.
 * @returns {Promise<unknown>} The parsed JSON.
 */
export async function load(url, options = {}) {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const fromFile = globalThis.location?.protocol === "file:";
    let response;
    try {
        response = await fetchFn(url);
    } catch (error) {
        throw new ClJsonError(
            `${url}: ${error.message}${fromFile ? FILE_HINT : ""}`,
        );
    }
    // A file:// response has no HTTP status: ok is true, or status 0.
    if (!response.ok && response.status !== 0) {
        throw new ClJsonError(`${url}: HTTP ${response.status}`);
    }
    try {
        return await response.json();
    } catch (error) {
        throw new ClJsonError(`${url}: not JSON: ${error.message}`);
    }
}

/**
 * Loads a JSON-CL resource and renders it into an existing element - what
 * `<script type="application/cl+json" src>` does, callable by hand. If loading
 * or evaluating fails, the reason is written into the target as text (and its
 * `data-cl-json-error` attribute), and the promise rejects.
 * @param {Element | string} target The element, or its id.
 * @param {string} url The resource.
 * @param {object} [state] Variables; default `{}`.
 * @param {object} [options] Interpreter options, plus `fetch`.
 * @returns {Promise<import("./cl-sdui-interpreter.js").MountHandle>} The live view.
 */
export async function include(target, url, state = {}, options = {}) {
    const doc = options.document ?? globalThis.document;
    const element =
        typeof target === "string"
            ? doc.getElementById(target.replace(/^#/, ""))
            : target;
    if (!element) {
        throw new ClJsonError(`include ${url}: no element ${target}`);
    }
    const { fetch: fetchFn, ...interpreterOptions } = options;
    try {
        const ast = await load(url, { fetch: fetchFn });
        return mount(element, ast, state, interpreterOptions);
    } catch (error) {
        showError(element, error, doc);
        throw error;
    }
}

/**
 * Replaces an element's content with an error's message and marks it with
 * `data-cl-json-error` - how a payload that could not be loaded or
 * evaluated shows why, instead of leaving its target empty.
 * @param {Element} element The target.
 * @param {Error} error The failure.
 * @param {Document} [doc] The document, when the element has no owner.
 */
export function showError(element, error, doc) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    element.appendChild(
        (element.ownerDocument ?? doc).createTextNode(
            error instanceof Error ? error.message : String(error),
        ),
    );
    element.setAttribute("data-cl-json-error", "");
}
