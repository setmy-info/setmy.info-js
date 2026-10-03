/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

/**
 * Error signalled by the interpreter: unknown operators, malformed forms, bad
 * format directives - the `cl:error` condition of this runtime.
 */
export class ClJsonError extends Error {
    /**
     * @param {string} message The condition report.
     */
    constructor(message) {
        super(message);
        this.name = "ClJsonError";
    }
}

/**
 * Common Lisp generalized boolean: only NIL is false. In JSON, NIL is `null`,
 * `false` and the empty list `[]`; `0` and `""` are true, as in Lisp.
 * @param {unknown} value Any evaluated value.
 * @returns {boolean} Whether the value is non-NIL.
 */
export function isTrue(value) {
    return !(
        value === null ||
        value === undefined ||
        value === false ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Whether a string is a keyword (`:div`, `:class`, `:on-click`).
 * @param {unknown} value Any value.
 * @returns {boolean} True for keyword strings.
 */
export function isKeyword(value) {
    return typeof value === "string" && /^:[A-Za-z_]/.test(value);
}

/**
 * Keyword name without the leading colon; other strings are returned as is.
 * @param {string} value A keyword or a plain string.
 * @returns {string} The bare name.
 */
export function keywordName(value) {
    return isKeyword(value) ? value.slice(1) : value;
}

/**
 * Whether a value is a DOM node (duck-typed, so any DOM implementation works).
 * @param {unknown} value Any value.
 * @returns {boolean} True for nodes.
 */
export function isNode(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof value.nodeType === "number"
    );
}

/**
 * `princ` representation - what `~a` and text rendering print.
 * @param {unknown} value Any value.
 * @returns {string} Human readable form.
 */
export function princ(value) {
    return print(value, false);
}

/**
 * `prin1` representation - what `~s` prints (strings quoted).
 * @param {unknown} value Any value.
 * @returns {string} Readable form.
 */
export function prin1(value) {
    return print(value, true);
}

function print(value, readably) {
    if (value === null || value === undefined || value === false) {
        return "NIL";
    }
    if (value === true) {
        return "T";
    }
    if (typeof value === "string") {
        return readably
            ? `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`
            : value;
    }
    if (Array.isArray(value)) {
        return value.length === 0
            ? "NIL"
            : `(${value.map((item) => print(item, readably)).join(" ")})`;
    }
    if (typeof value === "function") {
        return "#<FUNCTION>";
    }
    if (isNode(value)) {
        return "#<DOM-NODE>";
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return "#<OBJECT>";
        }
    }
    return String(value);
}
