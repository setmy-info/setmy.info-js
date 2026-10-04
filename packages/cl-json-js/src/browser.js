/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

// Entry of the classic <script src="cl-json.min.js"> build: the API as the
// global `ClJson`, and every <script type="application/cl+json"> payload of
// the page mounted once the document is parsed. Opt out with
// <script src="cl-json.min.js" data-autorun="false">.
import { renderScripts } from "./index.js";

export * from "./index.js";

const doc = globalThis.document;

function report(error) {
    console.error("cl-json-js:", error);
}

function autorun() {
    try {
        renderScripts(doc).catch(report);
    } catch (error) {
        report(error);
    }
}

const script = doc?.currentScript;

if (doc && script?.getAttribute("data-autorun") !== "false") {
    if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", autorun);
    } else {
        autorun();
    }
}
