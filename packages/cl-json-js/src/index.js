/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

import { mount } from "./cl-sdui-interpreter.js";
import { ClJsonError } from "./core.js";
import { include, load } from "./loader.js";

export {
    createInterpreter,
    evalCL,
    mount,
    render,
} from "./cl-sdui-interpreter.js";
export { ClJsonError, isTrue, prin1, princ } from "./core.js";
export { formatString } from "./format.js";
export { include, load } from "./loader.js";

/** The `type` of a `<script>` element holding a payload. */
export const SCRIPT_TYPE = "application/cl+json";

/**
 * Mounts every `<script type="application/cl+json">` payload of a page,
 * inline or loaded from a file:
 *
 *     <div id="app"></div>
 *     <script type="application/json" id="app-state">{"user": {"name": "Ann"}}</script>
 *     <script type="application/cl+json" data-target="#app" data-state="app-state">
 *         [":h1", ["cl:format", null, "Hello ~a", ["cl:getf", "user.name"]]]
 *     </script>
 *
 *     <script type="application/cl+json" src="pages/cart.json" data-target="cart"></script>
 *
 * `data-target` is an element id (`app`) or a CSS selector (`#app`, `.slot`);
 * default: a new `<div>` right after the script. The initial state is the JSON script with id `data-state`, or the
 * file `data-state-src`. Browsers never load `src` of a non-JavaScript script
 * type themselves: this loads it - `include()`, see loader.js.
 *
 * Inline payloads are mounted before this returns; payloads with `src` once
 * their files have arrived.
 * @param {ParentNode} [root] Where to look; default `document`.
 * @param {object} [options] Interpreter options, see `createInterpreter`, plus
 *     `fetch` (default `globalThis.fetch`).
 * @returns {Promise<import("./cl-sdui-interpreter.js").MountHandle[]>} One live view per payload.
 */
export function renderScripts(root = globalThis.document, options = {}) {
    const doc = options.document ?? root.ownerDocument ?? root;
    const { fetch: fetchFn, ...interpreterOptions } = options;
    const mountOptions = { ...interpreterOptions, document: doc };

    function targetOf(script) {
        const ref = script.getAttribute("data-target");
        if (ref) {
            const target =
                (/^[A-Za-z][\w-]*$/.test(ref) && doc.getElementById(ref)) ||
                doc.querySelector(ref);
            if (!target) {
                throw new ClJsonError(`data-target ${ref}: no such element`);
            }
            return target;
        }
        const target = doc.createElement("div");
        script.parentNode.insertBefore(target, script.nextSibling);
        return target;
    }

    const views = Array.from(
        root.querySelectorAll(`script[type="${SCRIPT_TYPE}"]`),
        (script) => {
            const target = targetOf(script);
            const src = script.getAttribute("src");
            const stateSrc = script.getAttribute("data-state-src");
            const stateId = script.getAttribute("data-state");
            const stateElement = stateId ? doc.getElementById(stateId) : null;
            const state = stateElement
                ? JSON.parse(stateElement.textContent)
                : {};
            if (!src && !stateSrc) {
                return mount(
                    target,
                    JSON.parse(script.textContent),
                    state,
                    mountOptions,
                );
            }
            const loading = stateSrc
                ? load(stateSrc, { fetch: fetchFn })
                : Promise.resolve(state);
            return loading.then((loadedState) =>
                src
                    ? include(target, src, loadedState, {
                          ...mountOptions,
                          fetch: fetchFn,
                      })
                    : mount(
                          target,
                          JSON.parse(script.textContent),
                          loadedState,
                          mountOptions,
                      ),
            );
        },
    );
    return Promise.all(views);
}
