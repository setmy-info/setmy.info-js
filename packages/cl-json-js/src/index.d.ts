/*!
 * cl-json-js
 * Copyright (c) 2026 Imre Tabur
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial
 */

/** A JSON-encoded Common Lisp form: an atom or a list. */
export type Form =
    string | number | boolean | null | Form[] | { [key: string]: Form };

/** Variables - the global environment of an evaluation. */
export type Scope = Record<string, unknown>;

export interface InterpreterOptions {
    /** DOM document; default `globalThis.document`. */
    document?: Document;
    /** Host functions by qualified name (`"app:save"`), called with the evaluated arguments. */
    functions?: Record<string, (...args: never[]) => unknown>;
}

export interface MountHandle<S extends Scope = Scope> {
    /** The live state; cl:setf / cl:incf / cl:push in event handlers mutate it and re-render. */
    readonly state: S;
    refresh(): MountHandle<S>;
    update(change: Partial<S> | ((state: S) => void)): MountHandle<S>;
    replace(ast: Form): MountHandle<S>;
    unmount(): void;
}

export interface Interpreter {
    evalCL(ast: Form, scope?: Scope): unknown;
    render(ast: Form, scope?: Scope): Node;
    mount<S extends Scope>(
        target: Element,
        ast: Form,
        state?: S,
    ): MountHandle<S>;
    defun(name: string, fn: (...args: never[]) => unknown): string;
}

export declare class ClJsonError extends Error {
    constructor(message: string);
}

export declare const SCRIPT_TYPE: 'application/cl+json';

export declare function createInterpreter(
    options?: InterpreterOptions,
): Interpreter;
export declare function evalCL(
    ast: Form,
    scope?: Scope,
    options?: InterpreterOptions,
): unknown;
export declare function render(
    ast: Form,
    scope?: Scope,
    options?: InterpreterOptions,
): Node;
export declare function mount<S extends Scope>(
    target: Element,
    ast: Form,
    state?: S,
    options?: InterpreterOptions,
): MountHandle<S>;
export declare function renderScripts(
    root?: ParentNode,
    options?: InterpreterOptions,
): MountHandle[];
export declare function formatString(control: string, args: unknown[]): string;
export declare function isTrue(value: unknown): boolean;
export declare function princ(value: unknown): string;
export declare function prin1(value: unknown): string;
