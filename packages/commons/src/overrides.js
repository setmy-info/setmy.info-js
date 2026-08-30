/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * The two override layers *above* the configuration files: environment
 * variables, then CLI options. Port of `smi_commons.overrides` and
 * `SetmyInfo.Commons.Config.Overrides`.
 *
 * Only *existing leaf paths* under an allowed root key can be overridden, so
 * an override can change a configured value but never invent one. A key
 * absent from every loaded file is not overridable - declare it in
 * `application.yaml` with a default and override that. That rule is also what
 * makes the mapping unambiguous: `SMI_A_B_C` binds to whichever of
 * `smi.a.b.c` / `smi.a.bC` / `smi.aB.c` actually exists.
 *
 * Each path yields two candidate names, tried in order, so both the
 * underscore-per-word form and Spring Boot's run-the-words-together form work:
 *
 *     ["smi", "server", "port"]  -> SMI_SERVER_PORT    --smi-server-port
 *     ["smi", "apiBaseUrl"]      -> SMI_API_BASE_URL   --smi-api-base-url
 *                                   SMI_APIBASEURL     --smi-apibaseurl
 *
 * The override string is coerced to the type of the value it replaces: a YAML
 * `port: 8080` stays a number, `secure: false` stays a boolean, a list splits
 * on commas, anything else stays a string.
 * @module overrides
 */

import {
    DEFAULT_OVERRIDE_ROOT_KEYS,
    RESERVED_ENVIRONMENT_VARIABLES,
} from "./constants.js";
import { splitAndTrim, toBoolean, toFloat, toInt } from "./strings.js";

/**
 * @typedef {string[]} ConfigPath
 * @typedef {{ path: ConfigPath, value: unknown }} Override
 */

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;
const NON_ALNUM = /[^A-Za-z0-9]+/g;

/**
 * A plain object (not an array, not `null`) - what a YAML/JSON mapping parses to.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMapping(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every path to a non-mapping leaf, restricted to `rootKeys` (`null` = all).
 * @param {Record<string, unknown>} config
 * @param {string[] | null | undefined} rootKeys
 * @returns {ConfigPath[]}
 */
export function leafPaths(config, rootKeys) {
    const paths = [];
    for (const [key, value] of Object.entries(config)) {
        if (
            rootKeys !== null &&
            rootKeys !== undefined &&
            !rootKeys.includes(key)
        ) {
            continue;
        }
        paths.push(...pathsOf(key, value));
    }
    return paths;
}

function pathsOf(key, value) {
    if (isMapping(value) && Object.keys(value).length > 0) {
        return Object.entries(value).flatMap(([childKey, childValue]) =>
            pathsOf(childKey, childValue).map((child) => [key, ...child]),
        );
    }
    return [[key]];
}

function snakeSegment(segment) {
    return flatSegment(segment.replace(CAMEL_BOUNDARY, "$1_$2"));
}

function flatSegment(segment) {
    return segment.replace(NON_ALNUM, "_");
}

function nameVariants(path, joiner) {
    const variants = [snakeSegment, flatSegment].map((segmentFunction) =>
        path.map(segmentFunction).join("_").replaceAll("_", joiner),
    );
    return [...new Set(variants)];
}

/**
 * Candidate environment variable names for a config path, most specific first.
 * @param {ConfigPath} path
 * @returns {string[]}
 */
export function environmentVariableNames(path) {
    return [
        ...new Set(nameVariants(path, "_").map((name) => name.toUpperCase())),
    ];
}

/**
 * Candidate CLI long options for a config path, most specific first.
 * @param {ConfigPath} path
 * @returns {string[]}
 */
export function cliOptionNames(path) {
    return [
        ...new Set(
            nameVariants(path, "-").map((name) => "--" + name.toLowerCase()),
        ),
    ];
}

/**
 * Every CLI option that could override something in `config`.
 * @param {Record<string, unknown>} config
 * @param {string[] | null} [rootKeys]
 * @returns {string[]}
 */
export function allCliOptionNames(
    config,
    rootKeys = DEFAULT_OVERRIDE_ROOT_KEYS,
) {
    return [...new Set(leafPaths(config, rootKeys).flatMap(cliOptionNames))];
}

/**
 * The value at `path` in `config`, or `defaultValue` when any key is missing.
 * @param {unknown} config
 * @param {Iterable<string>} path
 * @param {unknown} [defaultValue]
 * @returns {unknown}
 */
export function getIn(config, path, defaultValue = undefined) {
    let current = config;
    for (const key of path) {
        if (!isMapping(current) || !Object.hasOwn(current, key)) {
            return defaultValue;
        }
        current = current[key];
    }
    return current;
}

/**
 * The value of `name` in `argv` - `--name value` or `--name=value`; the last
 * occurrence wins, so a later option overrides an earlier one.
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | undefined}
 */
export function findOptionValue(argv, name) {
    let value;
    argv.forEach((argument, index) => {
        if (argument === name && index + 1 < argv.length) {
            value = argv[index + 1];
        } else if (argument.startsWith(name + "=")) {
            value = argument.slice(name.length + 1);
        }
    });
    return value;
}

/**
 * `raw` converted to the type of `current`.
 * @param {unknown} current
 * @param {string} raw
 * @returns {unknown}
 */
export function coerceLike(current, raw) {
    if (typeof current === "boolean") {
        return toBoolean(raw, current);
    }
    if (typeof current === "number") {
        return Number.isInteger(current)
            ? toInt(raw, current)
            : toFloat(raw, current);
    }
    if (Array.isArray(current)) {
        return splitAndTrim(raw);
    }
    return raw;
}

/**
 * `[{ path, value }]` for every leaf whose first present candidate name
 * `lookup` resolves. The seam unit tests use instead of the real environment.
 * @param {Record<string, unknown>} config
 * @param {string[] | null | undefined} rootKeys
 * @param {function(ConfigPath): Iterable<string>} namesBuilder
 * @param {function(string): (string|undefined)} lookup
 * @returns {Override[]}
 */
export function collect(config, rootKeys, namesBuilder, lookup) {
    const overrides = [];
    for (const path of leafPaths(config, rootKeys)) {
        for (const name of namesBuilder(path)) {
            const raw = lookup(name);
            if (raw !== undefined && raw !== null) {
                overrides.push({
                    path,
                    value: coerceLike(getIn(config, path), raw),
                });
                break;
            }
        }
    }
    return overrides;
}

/**
 * Overrides from `environment`; the `SMI_*` control variables are never consumed.
 * @param {Record<string, unknown>} config
 * @param {Record<string, string | undefined>} environment
 * @param {string[] | null} [rootKeys]
 * @returns {Override[]}
 */
export function environmentOverrides(
    config,
    environment,
    rootKeys = DEFAULT_OVERRIDE_ROOT_KEYS,
) {
    const names = (path) =>
        environmentVariableNames(path).filter(
            (name) => !RESERVED_ENVIRONMENT_VARIABLES.includes(name),
        );
    return collect(config, rootKeys, names, (name) => environment[name]);
}

/**
 * Overrides from `argv`.
 * @param {Record<string, unknown>} config
 * @param {string[]} argv
 * @param {string[] | null} [rootKeys]
 * @returns {Override[]}
 */
export function cliOverrides(
    config,
    argv,
    rootKeys = DEFAULT_OVERRIDE_ROOT_KEYS,
) {
    return collect(config, rootKeys, cliOptionNames, (name) =>
        findOptionValue(argv, name),
    );
}

/**
 * A deep copy of `config` with `overrides` written in.
 * @param {Record<string, unknown>} config
 * @param {Override[]} overrides
 * @returns {Record<string, unknown>}
 */
export function applyOverrides(config, overrides) {
    const result = structuredClone(config);
    for (const { path, value } of overrides) {
        let target = result;
        for (const key of path.slice(0, -1)) {
            target = target[key];
        }
        target[path[path.length - 1]] = value;
    }
    return result;
}

/**
 * `{ "smi.server.port": 9090 }` - the overrides keyed by dotted path, for summaries.
 * @param {Override[]} overrides
 * @returns {Record<string, unknown>}
 */
export function toDottedObject(overrides) {
    return Object.fromEntries(
        overrides.map(({ path, value }) => [path.join("."), value]),
    );
}
