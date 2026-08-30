/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * String helpers - the subset of `string.operations` (python-commons /
 * `SetmyInfo.Commons.String.Operations`) this library needs.
 * @module strings
 */

export const PLACEHOLDER_PATTERN = /\$\{([^}]+)\}/g;

const TRUE_WORDS = new Set(["true", "yes", "on", "1"]);
const FALSE_WORDS = new Set(["false", "no", "off", "0"]);

/**
 * `"a, b ,,c"` -> `["a", "b", "c"]`; `undefined`, `null` and blanks give `[]`.
 * @param {string | undefined | null} value
 * @param {string} [separator=","]
 * @returns {string[]}
 */
export function splitAndTrim(value, separator = ",") {
    if (!value) {
        return [];
    }
    return value
        .split(separator)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

/**
 * `true/yes/on/1` and `false/no/off/0`, case-insensitive; anything else is `defaultValue`.
 * @param {string} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function toBoolean(value, defaultValue) {
    const lowered = value.trim().toLowerCase();
    if (TRUE_WORDS.has(lowered)) {
        return true;
    }
    if (FALSE_WORDS.has(lowered)) {
        return false;
    }
    return defaultValue;
}

/**
 * An integer, or `defaultValue` when `value` is not one (`"9.5"` is not).
 * @param {string} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function toInt(value, defaultValue) {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    return trimmed !== "" && Number.isInteger(parsed) ? parsed : defaultValue;
}

/**
 * A number, or `defaultValue` when `value` is not one.
 * @param {string} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function toFloat(value, defaultValue) {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    return trimmed !== "" && Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * The distinct `NAME`s of every `${NAME}` in `text`, in order of appearance.
 * @param {string} text
 * @returns {string[]}
 */
export function findNamedPlaceholders(text) {
    return [
        ...new Set(
            [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]),
        ),
    ];
}

/**
 * @param {string} text
 * @param {string} name
 * @param {string} value
 * @returns {string}
 */
export function replaceNamedPlaceholder(text, name, value) {
    return text.replaceAll("${" + name + "}", value);
}

/**
 * Replaces every `${NAME}` whose variable is set. An unset one stays literal,
 * so the miss is visible in the parsed configuration instead of becoming an
 * empty string.
 * @param {string} text
 * @param {Record<string, string | undefined>} variables
 * @returns {string}
 */
export function resolvePlaceholders(text, variables) {
    let result = text;
    for (const name of findNamedPlaceholders(text)) {
        const value = variables[name];
        if (value !== undefined && value !== null) {
            result = replaceNamedPlaceholder(result, name, value);
        }
    }
    return result;
}
