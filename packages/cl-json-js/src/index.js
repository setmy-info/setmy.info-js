/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

import { mount } from "./cl-sdui-interpreter.js";

export {
    createInterpreter,
    evalCL,
    mount,
    render,
} from "./cl-sdui-interpreter.js";
export { ClJsonError, isTrue, prin1, princ } from "./core.js";
export { formatString } from "./format.js";

/** The `type` of a `<script>` element holding a payload. */
export const SCRIPT_TYPE = "application/cl+json";

/**
 * Mounts every `<script type="application/cl+json">` payload of a page:
 *
 *     <div id="app"></div>
 *     <script type="application/json" id="app-state">{"user": {"name": "Ann"}}</script>
 *     <script type="application/cl+json" data-target="#app" data-state="app-state">
 *         [":h1", ["cl:format", null, "Hello ~a", ["cl:getf", "user.name"]]]
 *     </script>
 *
 * `data-target` is a CSS selector (default: a new `<div>` right after the
 * script), `data-state` the id of a JSON script with the initial state.
 * @param {ParentNode} [root] Where to look; default `document`.
 * @param {object} [options] Interpreter options, see `createInterpreter`.
 * @returns {import("./cl-sdui-interpreter.js").MountHandle[]} One live view per payload.
 */
export function renderScripts(root = globalThis.document, options = {}) {
    const doc = options.document ?? root.ownerDocument ?? root;
    return Array.from(
        root.querySelectorAll(`script[type="${SCRIPT_TYPE}"]`),
        (script) => {
            const ast = JSON.parse(script.textContent);
            const stateId = script.getAttribute("data-state");
            const stateElement = stateId ? doc.getElementById(stateId) : null;
            const state = stateElement
                ? JSON.parse(stateElement.textContent)
                : {};
            const selector = script.getAttribute("data-target");
            let target = selector ? doc.querySelector(selector) : null;
            if (!target) {
                target = doc.createElement("div");
                script.parentNode.insertBefore(target, script.nextSibling);
            }
            return mount(target, ast, state, { ...options, document: doc });
        },
    );
}
