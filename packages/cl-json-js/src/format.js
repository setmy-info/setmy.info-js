/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

import { ClJsonError, isTrue, prin1, princ } from "./core.js";

// The FORMAT subset templates need: ~a ~s ~d ~b ~o ~x ~f ~$ ~p ~% ~& ~~ ~*,
// iteration ~{ ~} (with ~^ and ~:{), conditionals ~[ ~; ~] / ~:[ / ~@[ and
// tilde-newline. Prefix parameters are numeric only (~5d, ~,2f).
const DIRECTIVE = /^~([0-9,]*)([:@]*)([\s\S])/;

/**
 * Common Lisp `(format nil control args...)`.
 * @param {string} control The control string.
 * @param {unknown[]} args The format arguments.
 * @returns {string} The formatted text.
 */
export function formatString(control, args) {
    if (typeof control !== "string") {
        throw new ClJsonError("cl:format: control must be a string");
    }
    const state = { args, pos: 0, out: "" };
    run(parse(control, 0, []).nodes, state);
    return state.out;
}

function parse(control, start, stops) {
    const nodes = [];
    let text = "";
    let i = start;
    while (i < control.length) {
        if (control[i] !== "~") {
            text += control[i++];
            continue;
        }
        const match = DIRECTIVE.exec(control.slice(i));
        if (!match) {
            throw new ClJsonError(`cl:format: bad directive at ${i}`);
        }
        if (text) {
            nodes.push(text);
            text = "";
        }
        i += match[0].length;
        const node = {
            d: match[3].toLowerCase(),
            params: match[1]
                ? match[1]
                      .split(",")
                      .map((p) => (p === "" ? undefined : Number(p)))
                : [],
            colon: match[2].includes(":"),
            at: match[2].includes("@"),
        };
        if (stops.includes(node.d)) {
            return { nodes, i, stop: node.d };
        }
        if (node.d === "{") {
            const body = parse(control, i, ["}"]);
            if (body.stop !== "}") {
                throw new ClJsonError("cl:format: unterminated ~{");
            }
            node.body = body.nodes;
            i = body.i;
        } else if (node.d === "[") {
            node.clauses = [];
            for (;;) {
                const clause = parse(control, i, [";", "]"]);
                if (!clause.stop) {
                    throw new ClJsonError("cl:format: unterminated ~[");
                }
                node.clauses.push(clause.nodes);
                i = clause.i;
                if (clause.stop === "]") {
                    break;
                }
            }
        } else if (node.d === "\n") {
            while (control[i] === " " || control[i] === "\t") {
                i++;
            }
            continue;
        }
        nodes.push(node);
    }
    if (text) {
        nodes.push(text);
    }
    return { nodes, i, stop: null };
}

function next(state) {
    if (state.pos >= state.args.length) {
        throw new ClJsonError("cl:format: not enough arguments");
    }
    return state.args[state.pos++];
}

function pad(text, node) {
    const width = node.params[0] ?? 0;
    if (text.length >= width) {
        return text;
    }
    return node.at ? text.padStart(width) : text.padEnd(width);
}

function integer(value, node, radix) {
    if (typeof value !== "number") {
        return princ(value);
    }
    let text = Math.trunc(value).toString(radix);
    if (node.colon) {
        text = text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    if (node.at && value >= 0) {
        text = `+${text}`;
    }
    const width = node.params[0] ?? 0;
    return text.padStart(width);
}

function run(nodes, state) {
    for (const node of nodes) {
        if (typeof node === "string") {
            state.out += node;
            continue;
        }
        switch (node.d) {
            case "a":
                state.out += pad(princ(next(state)), node);
                break;
            case "s":
                state.out += pad(prin1(next(state)), node);
                break;
            case "d":
                state.out += integer(next(state), node, 10);
                break;
            case "b":
                state.out += integer(next(state), node, 2);
                break;
            case "o":
                state.out += integer(next(state), node, 8);
                break;
            case "x":
                state.out += integer(next(state), node, 16);
                break;
            case "f":
            case "$": {
                const value = Number(next(state));
                const digits = node.params[node.d === "$" ? 0 : 1];
                const text =
                    digits !== undefined || node.d === "$"
                        ? value.toFixed(digits ?? 2)
                        : String(value);
                // ~w,df and ~d,n,w$
                const width = node.params[node.d === "$" ? 2 : 0] ?? 0;
                state.out += text.padStart(width);
                break;
            }
            case "p": {
                if (node.colon) {
                    state.pos--;
                }
                const value = next(state);
                const plural = value !== 1;
                state.out += node.at
                    ? plural
                        ? "ies"
                        : "y"
                    : plural
                      ? "s"
                      : "";
                break;
            }
            case "%":
                state.out += "\n".repeat(node.params[0] ?? 1);
                break;
            case "&":
                if (state.out && !state.out.endsWith("\n")) {
                    state.out += "\n";
                }
                break;
            case "~":
                state.out += "~".repeat(node.params[0] ?? 1);
                break;
            case "*":
                state.pos += node.colon ? -1 : 1;
                break;
            case "^":
                if (state.pos >= state.args.length) {
                    return false;
                }
                break;
            case "{":
                iterate(node, state);
                break;
            case "[":
                conditional(node, state);
                break;
            default:
                throw new ClJsonError(
                    `cl:format: unknown directive ~${node.d}`,
                );
        }
    }
    return true;
}

function iterate(node, state) {
    const list = node.at ? state.args.slice(state.pos) : next(state);
    if (node.at) {
        state.pos = state.args.length;
    }
    if (!Array.isArray(list)) {
        throw new ClJsonError("cl:format: ~{ needs a list");
    }
    if (node.colon) {
        for (const sublist of list) {
            const inner = { args: sublist, pos: 0, out: "" };
            run(node.body, inner);
            state.out += inner.out;
        }
        return;
    }
    const inner = { args: list, pos: 0, out: "" };
    while (inner.pos < inner.args.length) {
        const before = inner.pos;
        if (!run(node.body, inner) || inner.pos === before) {
            break;
        }
    }
    state.out += inner.out;
}

function conditional(node, state) {
    let clause;
    if (node.colon) {
        clause = node.clauses[isTrue(next(state)) ? 1 : 0];
    } else if (node.at) {
        if (isTrue(state.args[state.pos])) {
            clause = node.clauses[0];
        } else {
            state.pos++;
        }
    } else {
        const index = node.params[0] ?? next(state);
        clause = node.clauses[index];
    }
    if (clause) {
        run(clause, state);
    }
}
