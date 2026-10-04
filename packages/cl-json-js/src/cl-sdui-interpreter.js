/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

// The core: one evaluation loop for Common Lisp special forms (cl:if,
// cl:let, cl:dolist, ...), builtin and user functions, and CL-WHO style HTML
// tag keywords (":div"), producing DOM nodes with document.createElement /
// createTextNode only - never HTML strings, never innerHTML.
//
// Evaluation rules for a JSON form:
//   [":tag", attrs?, children...]  element (CL-WHO); keyword pairs may follow the tag inline
//   ["cl:op", args...]             special form or builtin function
//   ["pkg:name", args...]          function defined by cl:defun or the `functions` option
//   [anything-else, ...]           a list; every element is evaluated (a fragment when rendered)
//   "text", 42, true, null         self-evaluating ("cl:t" and "cl:nil" are T and NIL)
//   {"key": ...}                   self-evaluating data (as an element's attributes: evaluated)
// Variables are read with ["cl:getf", "path.to.value"], never by bare strings,
// so plain strings in a payload are always text.

import {
    ClJsonError,
    isKeyword,
    isNode,
    isTrue,
    keywordName,
    prin1,
    princ,
} from "./core.js";
import { BUILTINS, callable, funcall, isCallable } from "./stdlib.js";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const BLOCKED_TAGS = new Set(["script"]);
const BLOCKED_ATTRIBUTES = new Set(["srcdoc"]);
const URL_ATTRIBUTES = new Set([
    "href",
    "src",
    "action",
    "formaction",
    "xlink:href",
    "poster",
    "cite",
    "background",
    "ping",
]);
const FUNCTION_NAME = /^[A-Za-z][\w-]*:[^\s:/][^\s:]*$/;
const TAG_NAME = /^[A-Za-z][\w.-]*$/;
const ATTRIBUTE_NAME = /^[A-Za-z_][\w:.-]*$/;
const EVENT_ATTRIBUTE = /^on-?[A-Za-z]/;
// Attribute families whose names contain a hyphen; any other hyphenated name
// in the first position of a list is taken as a custom element (<my-widget>).
const HYPHENATED_ATTRIBUTE =
    /^(?:data|aria|on|accept|http|stroke|fill|font|text|clip|color|flood|lighting|marker|stop|dominant|alignment|baseline|glyph|image|letter|word|pointer|shape|writing|vector|enable|unicode|paint|transform|mask)-/;
// Known element names: a list right after a tag that starts with one of these
// is a child element, not an attribute list ([":div", [":p", "text"]]).
const TAGS = new Set(
    (
        "a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption " +
        "cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset " +
        "figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins " +
        "kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option " +
        "output p picture pre progress q rp rt ruby s samp script search section select slot small source " +
        "span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr " +
        "track u ul var video wbr " +
        "svg g path circle rect line polyline polygon ellipse text tspan textPath defs use symbol " +
        "clipPath mask pattern image linearGradient radialGradient stop foreignObject marker filter desc " +
        "math mi mn mo ms mtext mrow msup msub msubsup mfrac msqrt mroot mtable mtr mtd"
    ).split(" "),
);

/**
 * Creates an interpreter with its own function namespace (cl:defun and the
 * `functions` option) and DOM document.
 * @param {object} [options] Interpreter options.
 * @param {Document} [options.document] DOM document; default `globalThis.document`.
 * @param {Record<string, Function>} [options.functions] Host functions by
 *     qualified name (`"app:save"`), callable from payloads.
 * @returns {Interpreter} The interpreter.
 */
export function createInterpreter(options = {}) {
    const functions = new Map();

    /**
     * Defines (or redefines) a host function callable as `["pkg:name", ...]`.
     * @param {string} name Qualified name, not in the `cl` package.
     * @param {Function} fn Receives the evaluated arguments.
     * @returns {string} The name.
     */
    function defun(name, fn) {
        checkFunctionName(name);
        if (typeof fn !== "function") {
            throw new ClJsonError(`defun ${name}: not a function`);
        }
        functions.set(name, callable(fn));
        return name;
    }

    for (const [name, fn] of Object.entries(options.functions ?? {})) {
        defun(name, fn);
    }

    function context(root, afterEvent) {
        return {
            doc: options.document ?? globalThis.document,
            ns: HTML_NS,
            root,
            functions,
            shared: { dirty: false, afterEvent },
        };
    }

    /**
     * Evaluates a form; elements come back as DOM nodes.
     * @param {unknown} ast The JSON form.
     * @param {object} [scope] Variables (the global environment).
     * @returns {unknown} The value.
     */
    function evalCL(ast, scope = {}) {
        return evaluate(ast, scope, context(scope));
    }

    /**
     * Evaluates a form into one DOM node; text and lists become a fragment.
     * @param {unknown} ast The JSON form.
     * @param {object} [scope] Variables.
     * @returns {Node} The node.
     */
    function render(ast, scope = {}) {
        const ctx = context(scope);
        const value = evaluate(ast, scope, ctx);
        if (isNode(value)) {
            return value;
        }
        const fragment = documentOf(ctx).createDocumentFragment();
        append(fragment, value, ctx);
        return fragment;
    }

    /**
     * Renders a form into `target` (replacing its children) and keeps it live:
     * an event handler that changes state (cl:setf, cl:incf, ...) re-renders.
     * @param {Element | string} element Container element, or its id.
     * @param {unknown} ast The JSON form.
     * @param {object} [state] Variables; mutated by cl:setf and friends.
     * @returns {MountHandle} The live view.
     */
    function mount(element, ast, state = {}) {
        const target =
            typeof element === "string"
                ? documentOf(context(state)).getElementById(
                      element.replace(/^#/, ""),
                  )
                : element;
        if (!isNode(target)) {
            throw new ClJsonError(
                typeof element === "string"
                    ? `mount: no element with id ${prin1(element)}`
                    : "mount: target is not a DOM node",
            );
        }
        let current = ast;
        let active = true;
        const handle = {
            state,
            refresh() {
                if (!active) {
                    return handle;
                }
                const ctx = context(state, handle.refresh);
                const focus = focusOf(target, ctx.doc);
                const output = evaluate(current, state, ctx);
                clear(target);
                append(target, output, ctx);
                restoreFocus(ctx.doc, focus);
                return handle;
            },
            update(change) {
                if (typeof change === "function") {
                    change(state);
                } else if (change && typeof change === "object") {
                    Object.assign(state, change);
                }
                return handle.refresh();
            },
            replace(nextAst) {
                current = nextAst;
                return handle.refresh();
            },
            unmount() {
                active = false;
                clear(target);
            },
        };
        return handle.refresh();
    }

    return { evalCL, render, mount, defun };
}

/**
 * Evaluates a form with a fresh interpreter - the `evalCL(ast, scope)` entry point.
 * @param {unknown} ast The JSON form.
 * @param {object} [scope] Variables.
 * @param {object} [options] See {@link createInterpreter}.
 * @returns {unknown} The value; elements are DOM nodes.
 */
export function evalCL(ast, scope = {}, options = {}) {
    return createInterpreter(options).evalCL(ast, scope);
}

/**
 * Evaluates a form into one DOM node with a fresh interpreter.
 * @param {unknown} ast The JSON form.
 * @param {object} [scope] Variables.
 * @param {object} [options] See {@link createInterpreter}.
 * @returns {Node} The node.
 */
export function render(ast, scope = {}, options = {}) {
    return createInterpreter(options).render(ast, scope);
}

/**
 * Mounts a live view with a fresh interpreter, see the interpreter's `mount`.
 * @param {Element | string} target Container element, or its id.
 * @param {unknown} ast The JSON form.
 * @param {object} [state] Variables.
 * @param {object} [options] See {@link createInterpreter}.
 * @returns {MountHandle} The live view.
 */
export function mount(target, ast, state = {}, options = {}) {
    return createInterpreter(options).mount(target, ast, state);
}

// ---------------------------------------------------------------- evaluation

function evaluate(form, scope, ctx) {
    if (Array.isArray(form)) {
        if (form.length === 0) {
            return null;
        }
        const head = form[0];
        if (typeof head === "string") {
            if (isKeyword(head)) {
                return element(form, scope, ctx);
            }
            if (head.startsWith("cl:")) {
                const special = SPECIAL_FORMS[head];
                if (special) {
                    return special(form.slice(1), scope, ctx);
                }
                const builtin = BUILTINS[head];
                if (builtin) {
                    return builtin(...evaluateAll(form.slice(1), scope, ctx));
                }
                throw new ClJsonError(`Undefined operator: ${head}`);
            }
            if (FUNCTION_NAME.test(head)) {
                const fn = ctx.functions.get(head);
                if (!fn) {
                    throw new ClJsonError(`Undefined function: ${head}`);
                }
                return fn(...evaluateAll(form.slice(1), scope, ctx));
            }
        } else if (Array.isArray(head) && head[0] === "cl:lambda") {
            return funcall(
                evaluate(head, scope, ctx),
                evaluateAll(form.slice(1), scope, ctx),
            );
        }
        return evaluateAll(form, scope, ctx);
    }
    if (form === "cl:t") {
        return true;
    }
    if (form === "cl:nil" || form === undefined) {
        return null;
    }
    return form;
}

function evaluateAll(forms, scope, ctx) {
    return forms.map((form) => evaluate(form, scope, ctx));
}

function progn(body, scope, ctx) {
    let value = null;
    for (const form of body) {
        value = evaluate(form, scope, ctx);
    }
    return value;
}

// ------------------------------------------------------------------- scopes

function checkName(name, operator) {
    if (
        typeof name !== "string" ||
        name === "" ||
        name.includes(".") ||
        FORBIDDEN_SEGMENTS.has(name)
    ) {
        throw new ClJsonError(
            `${operator}: illegal variable name ${prin1(name)}`,
        );
    }
    return name;
}

function checkFunctionName(name) {
    if (
        typeof name !== "string" ||
        !FUNCTION_NAME.test(name) ||
        name.startsWith("cl:")
    ) {
        throw new ClJsonError(
            `Illegal function name ${prin1(name)}: use a package prefix other than cl: ("app:save")`,
        );
    }
}

function splitPath(path, operator) {
    if (typeof path !== "string") {
        throw new ClJsonError(
            `${operator}: not a variable path: ${prin1(path)}`,
        );
    }
    const segments = keywordName(path).split(".");
    for (const segment of segments) {
        if (segment === "" || FORBIDDEN_SEGMENTS.has(segment)) {
            throw new ClJsonError(`${operator}: illegal path ${prin1(path)}`);
        }
    }
    return segments;
}

// The binding of `name` lives on the nearest scope layer that owns it; the
// layers are chained with Object.create, Object.prototype is never consulted.
function ownerOf(scope, name) {
    for (
        let layer = scope;
        layer !== null && layer !== Object.prototype;
        layer = Object.getPrototypeOf(layer)
    ) {
        if (Object.prototype.hasOwnProperty.call(layer, name)) {
            return layer;
        }
    }
    return null;
}

function lookup(scope, path, operator) {
    const [name, ...rest] = splitPath(path, operator);
    const owner = ownerOf(scope, name);
    let value = owner ? owner[name] : null;
    for (const segment of rest) {
        if (value === null || value === undefined) {
            return null;
        }
        value = value[segment];
    }
    return value === undefined ? null : value;
}

function assign(scope, path, value, ctx, operator) {
    const segments = splitPath(path, operator);
    const last = segments.at(-1);
    let target;
    if (segments.length === 1) {
        target = ownerOf(scope, last) ?? ctx.root;
    } else {
        target = lookup(scope, segments.slice(0, -1).join("."), operator);
        // Data only: no writing into DOM nodes (innerHTML, ...) or the window.
        if (
            target === null ||
            typeof target !== "object" ||
            isNode(target) ||
            target === globalThis
        ) {
            throw new ClJsonError(`${operator}: no data place ${prin1(path)}`);
        }
    }
    target[last] = value;
    ctx.shared.dirty = true;
    return value;
}

function child(scope, bindings) {
    const layer = Object.create(scope);
    for (const [name, value] of bindings) {
        layer[name] = value;
    }
    return layer;
}

function bindingList(spec, operator) {
    if (!Array.isArray(spec)) {
        throw new ClJsonError(`${operator}: bindings must be a list`);
    }
    return spec.map((binding) =>
        typeof binding === "string"
            ? [checkName(binding, operator), null]
            : Array.isArray(binding)
              ? [checkName(binding[0], operator), binding[1] ?? null]
              : checkName(binding, operator),
    );
}

function loopSpec(spec, operator) {
    if (!Array.isArray(spec) || spec.length < 2) {
        throw new ClJsonError(`${operator}: expected [var, form, result?]`);
    }
    return [checkName(spec[0], operator), spec[1], spec.length > 2, spec[2]];
}

function lambda(params, body, scope, ctx) {
    if (!Array.isArray(params)) {
        throw new ClJsonError("cl:lambda: parameters must be a list");
    }
    const required = [];
    const optional = [];
    let rest = null;
    let mode = "required";
    for (const param of params) {
        if (param === "&optional" || param === "&rest") {
            mode = param;
        } else if (mode === "required") {
            required.push(checkName(param, "cl:lambda"));
        } else if (mode === "&optional") {
            const [name, init] = Array.isArray(param) ? param : [param, null];
            optional.push([checkName(name, "cl:lambda"), init]);
        } else {
            rest = checkName(param, "cl:lambda");
        }
    }
    // Lenient arity, as JavaScript: event handlers may ignore the event.
    return callable((...args) => {
        const layer = Object.create(scope);
        required.forEach((name, i) => {
            layer[name] = args[i] ?? null;
        });
        optional.forEach(([name, init], i) => {
            const index = required.length + i;
            layer[name] =
                index < args.length ? args[index] : evaluate(init, layer, ctx);
        });
        if (rest) {
            layer[rest] = args.slice(required.length + optional.length);
        }
        return progn(body, layer, ctx);
    });
}

function sameKey(a, b) {
    return (
        a === b ||
        (typeof a === "string" &&
            typeof b === "string" &&
            keywordName(a) === keywordName(b))
    );
}

// ------------------------------------------------------------- special forms

// Each receives the unevaluated arguments, the scope and the context.
const SPECIAL_FORMS = {
    "cl:quote": ([datum]) => datum ?? null,
    "cl:function": ([designator], scope, ctx) => {
        if (Array.isArray(designator)) {
            return evaluate(designator, scope, ctx);
        }
        const fn = BUILTINS[designator] ?? ctx.functions.get(designator);
        if (!fn) {
            throw new ClJsonError(`Undefined function: ${prin1(designator)}`);
        }
        return fn;
    },
    "cl:progn": (body, scope, ctx) => progn(body, scope, ctx),
    "cl:if": ([test, then, otherwise], scope, ctx) =>
        isTrue(evaluate(test, scope, ctx))
            ? evaluate(then, scope, ctx)
            : evaluate(otherwise, scope, ctx),
    "cl:when": ([test, ...body], scope, ctx) =>
        isTrue(evaluate(test, scope, ctx)) ? progn(body, scope, ctx) : null,
    "cl:unless": ([test, ...body], scope, ctx) =>
        isTrue(evaluate(test, scope, ctx)) ? null : progn(body, scope, ctx),
    "cl:cond": (clauses, scope, ctx) => {
        for (const clause of clauses) {
            if (!Array.isArray(clause) || clause.length === 0) {
                throw new ClJsonError(
                    "cl:cond: clause must be a non-empty list",
                );
            }
            const test = evaluate(clause[0], scope, ctx);
            if (isTrue(test)) {
                return clause.length > 1
                    ? progn(clause.slice(1), scope, ctx)
                    : test;
            }
        }
        return null;
    },
    "cl:case": ([keyform, ...clauses], scope, ctx) => {
        const key = evaluate(keyform, scope, ctx);
        for (const clause of clauses) {
            if (!Array.isArray(clause) || clause.length === 0) {
                throw new ClJsonError(
                    "cl:case: clause must be a non-empty list",
                );
            }
            const keys = clause[0];
            const matches =
                keys === true ||
                keys === "cl:t" ||
                keys === "cl:otherwise" ||
                (Array.isArray(keys)
                    ? keys.some((candidate) => sameKey(candidate, key))
                    : sameKey(keys, key));
            if (matches) {
                return progn(clause.slice(1), scope, ctx);
            }
        }
        return null;
    },
    "cl:and": (forms, scope, ctx) => {
        let value = true;
        for (const form of forms) {
            value = evaluate(form, scope, ctx);
            if (!isTrue(value)) {
                return value === false ? false : null;
            }
        }
        return value;
    },
    "cl:or": (forms, scope, ctx) => {
        for (const form of forms) {
            const value = evaluate(form, scope, ctx);
            if (isTrue(value)) {
                return value;
            }
        }
        return null;
    },
    "cl:let": ([spec, ...body], scope, ctx) =>
        progn(
            body,
            child(
                scope,
                bindingList(spec, "cl:let").map(([name, init]) => [
                    name,
                    evaluate(init, scope, ctx),
                ]),
            ),
            ctx,
        ),
    "cl:let*": ([spec, ...body], scope, ctx) => {
        const layer = Object.create(scope);
        for (const [name, init] of bindingList(spec, "cl:let*")) {
            layer[name] = evaluate(init, layer, ctx);
        }
        return progn(body, layer, ctx);
    },
    // Unlike Common Lisp, dolist and dotimes collect the body's values (a
    // list), so they can produce children; a result form restores CL's return.
    "cl:dolist": ([spec, ...body], scope, ctx) => {
        const [name, listForm, hasResult, resultForm] = loopSpec(
            spec,
            "cl:dolist",
        );
        const items = evaluate(listForm, scope, ctx);
        if (isTrue(items) && !Array.isArray(items)) {
            throw new ClJsonError(`cl:dolist: not a list: ${prin1(items)}`);
        }
        const values = (isTrue(items) ? items : []).map((item) =>
            progn(body, child(scope, [[name, item]]), ctx),
        );
        return hasResult
            ? evaluate(resultForm, child(scope, [[name, null]]), ctx)
            : values;
    },
    "cl:dotimes": ([spec, ...body], scope, ctx) => {
        const [name, countForm, hasResult, resultForm] = loopSpec(
            spec,
            "cl:dotimes",
        );
        const count = evaluate(countForm, scope, ctx);
        if (typeof count !== "number") {
            throw new ClJsonError(`cl:dotimes: not a number: ${prin1(count)}`);
        }
        const values = Array.from({ length: Math.max(0, count) }, (_, i) =>
            progn(body, child(scope, [[name, i]]), ctx),
        );
        return hasResult
            ? evaluate(resultForm, child(scope, [[name, count]]), ctx)
            : values;
    },
    "cl:lambda": ([params, ...body], scope, ctx) =>
        lambda(params, body, scope, ctx),
    "cl:defun": ([name, params, ...body], scope, ctx) => {
        checkFunctionName(name);
        ctx.functions.set(name, lambda(params, body, scope, ctx));
        return name;
    },
    // (defvar name init): binds a global variable only when it is unbound - a
    // payload's initial state, kept when its view re-renders.
    "cl:defvar": ([name, init], scope, ctx) => {
        checkName(name, "cl:defvar");
        if (!ownerOf(scope, name)) {
            // A copy: state changes must not edit the payload's own literals.
            ctx.root[name] = copyData(evaluate(init, scope, ctx));
        }
        return name;
    },
    "cl:setq": (pairs, scope, ctx) => setPairs(pairs, scope, ctx, "cl:setq"),
    "cl:setf": (pairs, scope, ctx) => setPairs(pairs, scope, ctx, "cl:setf"),
    "cl:incf": ([place, delta], scope, ctx) =>
        assign(
            scope,
            place,
            lookup(scope, place, "cl:incf") +
                (delta === undefined ? 1 : evaluate(delta, scope, ctx)),
            ctx,
            "cl:incf",
        ),
    "cl:decf": ([place, delta], scope, ctx) =>
        assign(
            scope,
            place,
            lookup(scope, place, "cl:decf") -
                (delta === undefined ? 1 : evaluate(delta, scope, ctx)),
            ctx,
            "cl:decf",
        ),
    "cl:push": ([item, place], scope, ctx) => {
        const current = lookup(scope, place, "cl:push");
        return assign(
            scope,
            place,
            [
                evaluate(item, scope, ctx),
                ...(Array.isArray(current) ? current : []),
            ],
            ctx,
            "cl:push",
        );
    },
    // ["cl:getf", "user.name"] reads a variable path; ["cl:getf", place,
    // ":indicator", default?] is Common Lisp getf on a plist or an object.
    "cl:getf": (args, scope, ctx) => {
        const values = evaluateAll(args, scope, ctx);
        if (values.length === 1) {
            return lookup(scope, values[0], "cl:getf");
        }
        const [place, indicator, fallback = null] = values;
        const key = keywordName(String(indicator));
        if (Array.isArray(place)) {
            for (let i = 0; i + 1 < place.length; i += 2) {
                if (sameKey(place[i], indicator)) {
                    return place[i + 1];
                }
            }
            return fallback;
        }
        if (
            place !== null &&
            typeof place === "object" &&
            !FORBIDDEN_SEGMENTS.has(key) &&
            Object.prototype.hasOwnProperty.call(place, key)
        ) {
            return place[key];
        }
        return fallback;
    },
    "cl:symbol-value": ([path], scope, ctx) =>
        lookup(scope, evaluate(path, scope, ctx), "cl:symbol-value"),
    // ["cl:assoc", "path"] reads a variable; ["cl:assoc", item, alist] is CL assoc.
    "cl:assoc": (args, scope, ctx) => {
        const values = evaluateAll(args, scope, ctx);
        if (values.length === 1) {
            return lookup(scope, values[0], "cl:assoc");
        }
        const [item, alist] = values;
        if (!Array.isArray(alist)) {
            return null;
        }
        return (
            alist.find(
                (pair) => Array.isArray(pair) && sameKey(pair[0], item),
            ) ?? null
        );
    },
};

function copyData(value) {
    try {
        return structuredClone(value);
    } catch {
        return value; // functions, DOM nodes: kept as they are
    }
}

function setPairs(pairs, scope, ctx, operator) {
    if (pairs.length % 2 !== 0) {
        throw new ClJsonError(`${operator}: odd number of arguments`);
    }
    let value = null;
    for (let i = 0; i < pairs.length; i += 2) {
        value = assignPlace(
            pairs[i],
            evaluate(pairs[i + 1], scope, ctx),
            scope,
            ctx,
            operator,
        );
    }
    return value;
}

// A place is a variable path ("user.name") or a getf form:
// ["cl:getf", "path"] or ["cl:getf", place, ":indicator"] - CL's
// (setf (getf plist :done) t), on a plist or an object.
function assignPlace(place, value, scope, ctx, operator) {
    if (!Array.isArray(place) || place[0] !== "cl:getf") {
        return assign(scope, place, value, ctx, operator);
    }
    if (place.length === 2) {
        return assign(
            scope,
            evaluate(place[1], scope, ctx),
            value,
            ctx,
            operator,
        );
    }
    const target = evaluate(place[1], scope, ctx);
    const indicator = evaluate(place[2], scope, ctx);
    if (Array.isArray(target)) {
        let i = 0;
        while (i + 1 < target.length && !sameKey(target[i], indicator)) {
            i += 2;
        }
        if (i + 1 < target.length) {
            target[i + 1] = value;
        } else {
            target.push(indicator, value);
        }
    } else {
        const key = keywordName(String(indicator));
        if (
            !isPlainObject(target) ||
            target === globalThis ||
            FORBIDDEN_SEGMENTS.has(key)
        ) {
            throw new ClJsonError(`${operator}: no data place ${prin1(place)}`);
        }
        target[key] = value;
    }
    ctx.shared.dirty = true;
    return value;
}

// ------------------------------------------------------------------ the DOM

function documentOf(ctx) {
    if (!ctx.doc) {
        throw new ClJsonError(
            "No DOM document: pass { document } in the options outside the browser",
        );
    }
    return ctx.doc;
}

// The prompt-style attribute list: [":class", "card", ":id", "main"]. A list
// starting with a known tag or a custom element name is a child element.
function isAttributeList(value) {
    if (!Array.isArray(value) || value.length < 2 || value.length % 2 !== 0) {
        return false;
    }
    for (let i = 0; i < value.length; i += 2) {
        if (!isKeyword(value[i])) {
            return false;
        }
    }
    const first = value[0].slice(1);
    return (
        !TAGS.has(first) &&
        (!first.includes("-") || HYPHENATED_ATTRIBUTE.test(first))
    );
}

function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !isNode(value)
    );
}

function element(form, scope, ctx) {
    const tag = form[0].slice(1);
    if (!TAG_NAME.test(tag)) {
        throw new ClJsonError(`Illegal tag name: ${prin1(form[0])}`);
    }
    if (BLOCKED_TAGS.has(tag.toLowerCase())) {
        throw new ClJsonError(`Tag not allowed: ${tag}`);
    }
    const doc = documentOf(ctx);
    const ns = tag === "svg" ? SVG_NS : tag === "math" ? MATHML_NS : ctx.ns;
    const el =
        ns === HTML_NS ? doc.createElement(tag) : doc.createElementNS(ns, tag);
    const inner = { ...ctx, ns: tag === "foreignObject" ? HTML_NS : ns };

    let i = 1;
    if (isPlainObject(form[1])) {
        for (const [name, value] of Object.entries(form[1])) {
            setAttribute(el, name, evaluate(value, scope, ctx), ctx);
        }
        i = 2;
    } else if (isAttributeList(form[1])) {
        for (let j = 0; j < form[1].length; j += 2) {
            setAttribute(
                el,
                form[1][j],
                evaluate(form[1][j + 1], scope, ctx),
                ctx,
            );
        }
        i = 2;
    }
    // CL-WHO's own syntax: keyword/value pairs right after the tag.
    while (i + 1 < form.length && isKeyword(form[i])) {
        setAttribute(el, form[i], evaluate(form[i + 1], scope, ctx), ctx);
        i += 2;
    }
    for (; i < form.length; i++) {
        append(el, evaluate(form[i], scope, inner), inner);
    }
    return el;
}

function isUnsafeUrl(value) {
    const compact = [...value]
        .filter((c) => c.charCodeAt(0) > 32)
        .join("")
        .toLowerCase();
    return (
        compact.startsWith("javascript:") ||
        compact.startsWith("vbscript:") ||
        (compact.startsWith("data:") && !compact.startsWith("data:image/"))
    );
}

function attributeText(name, value) {
    if (value === true) {
        return "";
    }
    if (name === "style" && isPlainObject(value)) {
        return Object.entries(value)
            .filter(([, v]) => isTrue(v))
            .map(([k, v]) => `${k}: ${princ(v)}`)
            .join("; ");
    }
    if (Array.isArray(value)) {
        return value
            .filter(isTrue)
            .map((v) => princ(v))
            .join(" ");
    }
    return princ(value);
}

function setAttribute(el, rawName, value, ctx) {
    const name = keywordName(rawName);
    if (!ATTRIBUTE_NAME.test(name)) {
        throw new ClJsonError(`Illegal attribute name: ${prin1(rawName)}`);
    }
    if (EVENT_ATTRIBUTE.test(name)) {
        if (!isTrue(value)) {
            return;
        }
        if (!isCallable(value)) {
            throw new ClJsonError(
                `Event attribute :${name} needs a function (cl:lambda), got ${prin1(value)}`,
            );
        }
        const type =
            name[2] === "-" ? name.slice(3) : name.slice(2).toLowerCase();
        el.addEventListener(type, (event) => {
            ctx.shared.dirty = false;
            value(event);
            if (ctx.shared.dirty && ctx.shared.afterEvent) {
                ctx.shared.afterEvent();
            }
        });
        return;
    }
    if (value === null || value === undefined || value === false) {
        return;
    }
    const lower = name.toLowerCase();
    if (BLOCKED_ATTRIBUTES.has(lower)) {
        return;
    }
    const text = attributeText(name, value);
    if (URL_ATTRIBUTES.has(lower) && isUnsafeUrl(text)) {
        return;
    }
    if (lower.startsWith("xlink:")) {
        el.setAttributeNS(XLINK_NS, name, text);
    } else {
        el.setAttribute(name, text);
    }
}

// Renderable values: nodes, text (strings, numbers, ...), lists of them.
// NIL, T, false and functions render as nothing.
function append(parent, value, ctx) {
    if (
        value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        typeof value === "function"
    ) {
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            append(parent, item, ctx);
        }
    } else if (isNode(value)) {
        parent.appendChild(value);
    } else {
        parent.appendChild(documentOf(ctx).createTextNode(princ(value)));
    }
}

function clear(target) {
    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }
}

// A re-render replaces the elements; keep the caret in the focused field.
function focusOf(target, doc) {
    const active = doc?.activeElement;
    if (!active || !active.id || !target.contains?.(active)) {
        return null;
    }
    return {
        id: active.id,
        start: active.selectionStart,
        end: active.selectionEnd,
    };
}

function restoreFocus(doc, focus) {
    const el = focus ? doc.getElementById?.(focus.id) : null;
    if (!el || typeof el.focus !== "function") {
        return;
    }
    el.focus();
    if (
        typeof focus.start === "number" &&
        typeof el.setSelectionRange === "function"
    ) {
        try {
            el.setSelectionRange(focus.start, focus.end);
        } catch {
            // not a text control
        }
    }
}

/**
 * @typedef {object} Interpreter
 * @property {(ast: unknown, scope?: object) => unknown} evalCL Evaluates a form.
 * @property {(ast: unknown, scope?: object) => Node} render Evaluates into one node.
 * @property {(target: Element, ast: unknown, state?: object) => MountHandle} mount Live view.
 * @property {(name: string, fn: Function) => string} defun Registers a host function.
 */

/**
 * @typedef {object} MountHandle
 * @property {object} state The live state (the global scope).
 * @property {() => MountHandle} refresh Re-renders.
 * @property {(change: object | ((state: object) => void)) => MountHandle} update Changes state, re-renders.
 * @property {(ast: unknown) => MountHandle} replace Swaps the payload, re-renders.
 * @property {() => void} unmount Stops and empties the target.
 */
