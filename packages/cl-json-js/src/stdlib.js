/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

import { ClJsonError, isTrue, keywordName, prin1, princ } from "./core.js";
import { formatString } from "./format.js";

// Only functions made by the interpreter (cl:lambda, cl:function, cl:defun,
// host functions registered through the `functions` option) carry this mark.
// cl:funcall, event handlers and the higher-order builtins refuse anything
// else, so a payload can never reach and call an arbitrary JavaScript
// function (window.eval, ...) found by walking objects in scope.
const CALLABLE = Symbol("cl-json-js.callable");

/**
 * Marks a JavaScript function as callable from Lisp code.
 * @template {Function} F
 * @param {F} fn The function.
 * @returns {F} The same function, marked.
 */
export function callable(fn) {
    if (!isCallable(fn)) {
        Object.defineProperty(fn, CALLABLE, { value: true });
    }
    return fn;
}

/**
 * Whether a value is a function callable from Lisp code.
 * @param {unknown} value Any value.
 * @returns {boolean} True for marked functions.
 */
export function isCallable(value) {
    return typeof value === "function" && value[CALLABLE] === true;
}

/**
 * Calls a Lisp-callable function.
 * @param {unknown} fn The function designator (already evaluated).
 * @param {unknown[]} args The arguments.
 * @returns {unknown} The function's value.
 */
export function funcall(fn, args) {
    if (!isCallable(fn)) {
        throw new ClJsonError(`Not a function: ${prin1(fn)}`);
    }
    return fn(...args);
}

function list(value, operator) {
    if (value === null || value === undefined || value === false) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new ClJsonError(`${operator}: not a list: ${prin1(value)}`);
    }
    return value;
}

function numbers(args, operator) {
    for (const arg of args) {
        if (typeof arg !== "number") {
            throw new ClJsonError(`${operator}: not a number: ${prin1(arg)}`);
        }
    }
    return args;
}

function number(value, operator) {
    return numbers([value], operator)[0];
}

// The divisor of mod, rem, floor, ... : a number other than zero.
function divisor(value, operator) {
    if (number(value, operator) === 0) {
        throw new ClJsonError(`${operator}: division by zero`);
    }
    return value;
}

function last(args) {
    return args[args.length - 1];
}

function chain(operator, test) {
    return (...args) => {
        numbers(args, operator);
        for (let i = 1; i < args.length; i++) {
            if (!test(args[i - 1], args[i])) {
                return false;
            }
        }
        return true;
    };
}

/**
 * Deep structural equality, Common Lisp `equal` over JSON data.
 * @param {unknown} a First value.
 * @param {unknown} b Second value.
 * @returns {boolean} Whether both are equal.
 */
export function equal(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, i) => equal(item, b[i]));
    }
    if (!isTrue(a) && !isTrue(b)) {
        return true;
    }
    return a === b;
}

function eql(a, b) {
    return a === b || (!isTrue(a) && !isTrue(b));
}

function stringDesignator(value) {
    return typeof value === "string" ? keywordName(value) : princ(value);
}

// The result type: "list" / ":list" / "cl:list" (and the same for "string").
function concatenate(type, ...sequences) {
    if (keywordName(String(type)).replace(/^cl:/, "") === "list") {
        return sequences.flatMap((sequence) =>
            list(sequence, "cl:concatenate"),
        );
    }
    return sequences
        .map((sequence) =>
            Array.isArray(sequence) ? sequence.join("") : princ(sequence),
        )
        .join("");
}

function capitalize(text) {
    return String(text).replace(
        /[A-Za-z0-9]+/g,
        (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
    );
}

/**
 * The builtin functions - operators whose arguments are evaluated first.
 * Special forms (cl:if, cl:let, ...) live in the interpreter.
 * @type {Record<string, Function>}
 */
export const BUILTINS = {
    // Arithmetic
    "cl:+": (...args) => numbers(args, "cl:+").reduce((a, b) => a + b, 0),
    "cl:*": (...args) => numbers(args, "cl:*").reduce((a, b) => a * b, 1),
    "cl:-": (first, ...rest) => {
        numbers([first, ...rest], "cl:-");
        return rest.length === 0 ? -first : rest.reduce((a, b) => a - b, first);
    },
    "cl:/": (first, ...rest) => {
        numbers([first, ...rest], "cl:/");
        if ((rest.length === 0 ? [first] : rest).includes(0)) {
            throw new ClJsonError("cl:/: division by zero");
        }
        return rest.length === 0
            ? 1 / first
            : rest.reduce((a, b) => a / b, first);
    },
    "cl:1+": (n) => number(n, "cl:1+") + 1,
    "cl:1-": (n) => number(n, "cl:1-") - 1,
    "cl:mod": (a, b) => {
        numbers([a], "cl:mod");
        divisor(b, "cl:mod");
        return ((a % b) + b) % b;
    },
    "cl:rem": (a, b) => number(a, "cl:rem") % divisor(b, "cl:rem"),
    "cl:abs": (n) => Math.abs(number(n, "cl:abs")),
    "cl:min": (...args) => Math.min(...numbers(args, "cl:min")),
    "cl:max": (...args) => Math.max(...numbers(args, "cl:max")),
    "cl:floor": (a, b = 1) =>
        Math.floor(number(a, "cl:floor") / divisor(b, "cl:floor")),
    "cl:ceiling": (a, b = 1) =>
        Math.ceil(number(a, "cl:ceiling") / divisor(b, "cl:ceiling")),
    "cl:round": (a, b = 1) =>
        Math.round(number(a, "cl:round") / divisor(b, "cl:round")),
    "cl:truncate": (a, b = 1) =>
        Math.trunc(number(a, "cl:truncate") / divisor(b, "cl:truncate")),
    "cl:sqrt": (n) => Math.sqrt(number(n, "cl:sqrt")),
    "cl:expt": (base, power) =>
        number(base, "cl:expt") ** number(power, "cl:expt"),
    "cl:random": (n) => {
        const r = Math.random() * number(n, "cl:random");
        return Number.isInteger(n) ? Math.floor(r) : r;
    },

    // Comparison and equality
    "cl:=": chain("cl:=", (a, b) => a === b),
    "cl:/=": (...args) => new Set(numbers(args, "cl:/=")).size === args.length,
    "cl:<": chain("cl:<", (a, b) => a < b),
    "cl:>": chain("cl:>", (a, b) => a > b),
    "cl:<=": chain("cl:<=", (a, b) => a <= b),
    "cl:>=": chain("cl:>=", (a, b) => a >= b),
    "cl:eq": (a, b) => eql(a, b),
    "cl:eql": (a, b) => eql(a, b),
    "cl:equal": (a, b) => equal(a, b),
    "cl:string=": (a, b) => stringDesignator(a) === stringDesignator(b),
    "cl:string-equal": (a, b) =>
        stringDesignator(a).toLowerCase() === stringDesignator(b).toLowerCase(),
    "cl:string<": (a, b) => stringDesignator(a) < stringDesignator(b),
    "cl:string>": (a, b) => stringDesignator(a) > stringDesignator(b),

    // Predicates
    "cl:not": (value) => !isTrue(value),
    "cl:null": (value) => !isTrue(value),
    "cl:zerop": (n) => number(n, "cl:zerop") === 0,
    "cl:plusp": (n) => number(n, "cl:plusp") > 0,
    "cl:minusp": (n) => number(n, "cl:minusp") < 0,
    "cl:evenp": (n) => number(n, "cl:evenp") % 2 === 0,
    "cl:oddp": (n) => Math.abs(number(n, "cl:oddp") % 2) === 1,
    "cl:numberp": (value) => typeof value === "number",
    "cl:integerp": (value) => Number.isInteger(value),
    "cl:stringp": (value) => typeof value === "string",
    "cl:keywordp": (value) =>
        typeof value === "string" && /^:[A-Za-z_]/.test(value),
    "cl:listp": (value) => Array.isArray(value) || !isTrue(value),
    "cl:consp": (value) => Array.isArray(value) && value.length > 0,
    "cl:atom": (value) => !(Array.isArray(value) && value.length > 0),
    "cl:functionp": (value) => isCallable(value),
    "cl:every": (fn, sequence) =>
        list(sequence, "cl:every").every((item) => isTrue(funcall(fn, [item]))),
    "cl:some": (fn, sequence) => {
        for (const item of list(sequence, "cl:some")) {
            const value = funcall(fn, [item]);
            if (isTrue(value)) {
                return value;
            }
        }
        return null;
    },

    // Lists and sequences
    "cl:list": (...args) => args,
    "cl:list*": (...args) => [
        ...args.slice(0, -1),
        ...list(last(args), "cl:list*"),
    ],
    "cl:cons": (item, rest) => [item, ...list(rest, "cl:cons")],
    "cl:length": (sequence) =>
        typeof sequence === "string"
            ? sequence.length
            : list(sequence, "cl:length").length,
    "cl:first": (sequence) => list(sequence, "cl:first")[0] ?? null,
    "cl:car": (sequence) => list(sequence, "cl:car")[0] ?? null,
    "cl:second": (sequence) => list(sequence, "cl:second")[1] ?? null,
    "cl:third": (sequence) => list(sequence, "cl:third")[2] ?? null,
    "cl:rest": (sequence) => list(sequence, "cl:rest").slice(1),
    "cl:cdr": (sequence) => list(sequence, "cl:cdr").slice(1),
    "cl:last": (sequence) => list(sequence, "cl:last").slice(-1),
    "cl:nth": (n, sequence) => list(sequence, "cl:nth")[n] ?? null,
    "cl:nthcdr": (n, sequence) => list(sequence, "cl:nthcdr").slice(n),
    "cl:elt": (sequence, n) =>
        (typeof sequence === "string"
            ? sequence[n]
            : list(sequence, "cl:elt")[n]) ?? null,
    "cl:append": (...lists) => lists.flatMap((item) => list(item, "cl:append")),
    "cl:reverse": (sequence) =>
        typeof sequence === "string"
            ? [...sequence].reverse().join("")
            : [...list(sequence, "cl:reverse")].reverse(),
    "cl:subseq": (sequence, start, end) =>
        typeof sequence === "string"
            ? sequence.slice(start, end ?? undefined)
            : list(sequence, "cl:subseq").slice(start, end ?? undefined),
    "cl:member": (item, sequence) => {
        const items = list(sequence, "cl:member");
        const index = items.findIndex((other) => eql(item, other));
        return index < 0 ? null : items.slice(index);
    },
    "cl:find": (item, sequence) =>
        list(sequence, "cl:find").find((other) => eql(item, other)) ?? null,
    "cl:find-if": (fn, sequence) =>
        list(sequence, "cl:find-if").find((item) =>
            isTrue(funcall(fn, [item])),
        ) ?? null,
    "cl:position": (item, sequence) => {
        const index = list(sequence, "cl:position").findIndex((other) =>
            eql(item, other),
        );
        return index < 0 ? null : index;
    },
    "cl:count": (item, sequence) =>
        list(sequence, "cl:count").filter((other) => eql(item, other)).length,
    "cl:remove": (item, sequence) =>
        list(sequence, "cl:remove").filter((other) => !eql(item, other)),
    "cl:remove-if": (fn, sequence) =>
        list(sequence, "cl:remove-if").filter(
            (item) => !isTrue(funcall(fn, [item])),
        ),
    "cl:remove-if-not": (fn, sequence) =>
        list(sequence, "cl:remove-if-not").filter((item) =>
            isTrue(funcall(fn, [item])),
        ),
    "cl:mapcar": (fn, ...lists) => {
        const sources = lists.map((item) => list(item, "cl:mapcar"));
        const length = Math.min(...sources.map((source) => source.length));
        return Array.from({ length }, (_, i) =>
            funcall(
                fn,
                sources.map((source) => source[i]),
            ),
        );
    },
    "cl:reduce": (fn, sequence, ...rest) => {
        const items = list(sequence, "cl:reduce");
        return rest.length > 0
            ? items.reduce((acc, item) => funcall(fn, [acc, item]), rest[0])
            : items.length === 0
              ? funcall(fn, [])
              : items.reduce((acc, item) => funcall(fn, [acc, item]));
    },
    "cl:sort": (sequence, fn) =>
        [...list(sequence, "cl:sort")].sort((a, b) =>
            isTrue(funcall(fn, [a, b]))
                ? -1
                : isTrue(funcall(fn, [b, a]))
                  ? 1
                  : 0,
        ),

    // Property lists, alists, hash tables (plain JSON objects)
    "cl:gethash": (key, table) =>
        table !== null &&
        typeof table === "object" &&
        Object.prototype.hasOwnProperty.call(table, keywordName(key))
            ? table[keywordName(key)]
            : null,

    // Strings and printing
    "cl:string": (value) => stringDesignator(value),
    "cl:string-upcase": (text) => stringDesignator(text).toUpperCase(),
    "cl:string-downcase": (text) => stringDesignator(text).toLowerCase(),
    "cl:string-capitalize": (text) => capitalize(stringDesignator(text)),
    "cl:string-trim": (bag, text) => {
        const chars = new Set(Array.isArray(bag) ? bag : [...String(bag)]);
        const value = [...String(text)];
        let start = 0;
        let end = value.length;
        while (start < end && chars.has(value[start])) start++;
        while (end > start && chars.has(value[end - 1])) end--;
        return value.slice(start, end).join("");
    },
    "cl:parse-integer": (text) => {
        const value = Number.parseInt(String(text).trim(), 10);
        if (Number.isNaN(value)) {
            throw new ClJsonError(
                `cl:parse-integer: not an integer: ${prin1(text)}`,
            );
        }
        return value;
    },
    "cl:princ-to-string": (value) => princ(value),
    "cl:prin1-to-string": (value) => prin1(value),
    "cl:concatenate": (type, ...sequences) => concatenate(type, ...sequences),
    "cl:format": (destination, control, ...args) => {
        const text = formatString(control, args);
        if (isTrue(destination)) {
            console.log(text);
            return null;
        }
        return text;
    },
    // CL-WHO's `str`: the printed values, NIL printing as nothing.
    "cl:str": (...args) =>
        args.map((arg) => (isTrue(arg) ? princ(arg) : "")).join(""),
    "cl:print": (value) => {
        console.log(prin1(value));
        return value;
    },

    // Functions and conditions
    "cl:funcall": (fn, ...args) => funcall(fn, args),
    "cl:apply": (fn, ...args) =>
        funcall(fn, [...args.slice(0, -1), ...list(last(args), "cl:apply")]),
    "cl:identity": (value) => value,
    "cl:error": (control, ...args) => {
        throw new ClJsonError(formatString(String(control), args));
    },
};

for (const fn of Object.values(BUILTINS)) {
    callable(fn);
}
