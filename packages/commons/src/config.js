/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * Spring Boot style layered application configuration. Port of
 * `smi_commons.config` (setmy.info-python), `smi_python_commons.config.application`
 * (python-commons) and `SetmyInfo.Commons.Config.Application` (setmy.info-elixir),
 * keeping their names, their step order and their intermediate results.
 *
 * Overload order - every layer overrides the one above it:
 *
 * | Layer                                               | Selected by                   |
 * |-----------------------------------------------------|-------------------------------|
 * | `application.{json,yml,yaml}`                       | `configPaths`, in order       |
 * | `application-<profile>.{json,yml,yaml}`             | active profiles, in order     |
 * | optional files from `SMI_OPTIONAL_CONFIG_FILES`     | environment                   |
 * | optional files from `--smi-optional-config-files`   | CLI                           |
 * | `${ENV_VAR}` placeholders inside those files        | resolved as each file is read |
 * | environment variables (`SMI_...`)                   | overrides.js                  |
 * | CLI options (`--smi-...`)                           | overrides.js                  |
 *
 * Files merge deeply. `local` is the active profile unless `SMI_PROFILES`
 * replaces the list, or `--smi-profiles` replaces it again - the layers
 * replace rather than accumulate.
 *
 *     import { Application } from "@setmy-info/commons";
 *
 *     const application = new Application(process.argv.slice(2));
 *     const port = application.get("smi.server.port", 8080);
 *
 *     SMI_SERVER_PORT=9090 my-service --smi-profiles dev --smi-server-port 9091
 * @module config
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import {
    APPLICATION_FILE_PREFIX,
    APPLICATION_FILE_SUFFIXES,
    DEFAULT_CONFIG_PATHS,
    DEFAULT_OVERRIDE_ROOT_KEYS,
    DEFAULT_PROFILES,
    SMI_CONFIG_PATHS,
    SMI_CONFIG_PATHS_OPTION,
    SMI_NAME,
    SMI_NAME_OPTION,
    SMI_OPTIONAL_CONFIG_FILES,
    SMI_OPTIONAL_CONFIG_FILES_OPTION,
    SMI_PROFILES,
    SMI_PROFILES_OPTION,
} from "./constants.js";
import * as overrides from "./overrides.js";
import { resolvePlaceholders, splitAndTrim } from "./strings.js";

const YAML_SUFFIXES = [".yaml", ".yml"];
const JSON_SUFFIXES = [".json"];

/**
 * A comma separated environment variable as a list; unset gives `[]`.
 * @param {Record<string, string | undefined>} environment
 * @param {string} name
 * @returns {string[]}
 */
export function environmentList(environment, name) {
    return splitAndTrim(environment[name]);
}

/**
 * A comma separated CLI option as a list; absent gives `[]`.
 * @param {string[]} argv
 * @param {string} name
 * @returns {string[]}
 */
export function cliList(argv, name) {
    return splitAndTrim(overrides.findOptionValue(argv, name));
}

/**
 * The last argument that is a non-empty list, or `[]`.
 * @param {...(string[] | undefined | null)} values
 * @returns {string[]}
 */
export function findLastNotNoneAndEmpty(...values) {
    let result = [];
    for (const value of values) {
        if (value && value.length > 0) {
            result = [...value];
        }
    }
    return result;
}

/**
 * Deep merge, right side winning; a `null`/`undefined` on the right keeps the left value.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {unknown}
 */
export function mergeDicts(left, right) {
    if (overrides.isMapping(left) && overrides.isMapping(right)) {
        const merged = { ...left };
        for (const [key, value] of Object.entries(right)) {
            merged[key] = Object.hasOwn(merged, key)
                ? mergeDicts(merged[key], value)
                : value;
        }
        return merged;
    }
    if (right === null || right === undefined) {
        return left;
    }
    return right;
}

/**
 * Folds parsed files into one configuration, in load order.
 * @param {Iterable<Record<string, unknown>>} contents
 * @returns {Record<string, unknown>}
 */
export function mergeConfig(contents) {
    return [...contents].reduce(
        (merged, content) => mergeDicts(merged, content),
        {},
    );
}

/**
 * `application.json`, `.yml`, `.yaml`, then the same per profile, in order.
 * @param {string[]} profiles
 * @returns {string[]}
 */
export function applicationFiles(profiles) {
    const prefixes = [
        APPLICATION_FILE_PREFIX,
        ...profiles.map((profile) => `${APPLICATION_FILE_PREFIX}-${profile}`),
    ];
    return prefixes.flatMap((prefix) =>
        APPLICATION_FILE_SUFFIXES.map((suffix) => `${prefix}.${suffix}`),
    );
}

/**
 * Reads a YAML or JSON file, `${ENV_VAR}` placeholders resolved before
 * parsing. A file with an unknown suffix or without a mapping at its root
 * contributes nothing.
 * @param {string} filePath
 * @param {Record<string, string | undefined>} environment
 * @returns {Record<string, unknown>}
 */
export function parseFile(filePath, environment) {
    const text = resolvePlaceholders(
        fs.readFileSync(filePath, "utf8"),
        environment,
    );
    const suffix = path.extname(filePath).toLowerCase();
    let parsed;
    if (YAML_SUFFIXES.includes(suffix)) {
        parsed = parseYaml(text);
    } else if (JSON_SUFFIXES.includes(suffix)) {
        parsed = JSON.parse(text);
    }
    return overrides.isMapping(parsed) ? { ...parsed } : {};
}

function isFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * @typedef {object} ApplicationOptions
 * @property {string[]} [configPaths] replaces `DEFAULT_CONFIG_PATHS`
 * @property {string[]} [defaultProfiles] replaces `DEFAULT_PROFILES`
 * @property {string[] | null} [overrideRootKeys] replaces `DEFAULT_OVERRIDE_ROOT_KEYS`; `null` = every root key
 * @property {Record<string, string | undefined>} [environment] replaces `process.env`
 */

/** The loaded configuration and every intermediate step that produced it. */
export class Application {
    /**
     * `argv` defaults to `process.argv.slice(2)` and `environment` to `process.env`.
     * @param {string[]} [argv]
     * @param {ApplicationOptions} [options]
     */
    constructor(argv = undefined, options = {}) {
        const {
            configPaths,
            defaultProfiles,
            overrideRootKeys = DEFAULT_OVERRIDE_ROOT_KEYS,
            environment,
        } = options;

        /** @type {string[]} */
        this.argv = [...(argv ?? process.argv.slice(2))];
        /** @type {Record<string, string | undefined>} */
        this.environment = { ...(environment ?? process.env) };
        this.overrideRootKeys = overrideRootKeys;

        this.envConfigPaths = environmentList(
            this.environment,
            SMI_CONFIG_PATHS,
        );
        this.cliConfigPaths = cliList(this.argv, SMI_CONFIG_PATHS_OPTION);
        /** @type {string[]} */
        this.configPaths = [
            ...(configPaths ?? DEFAULT_CONFIG_PATHS).map(String),
            ...this.envConfigPaths,
            ...this.cliConfigPaths,
        ];

        this.envProfiles = environmentList(this.environment, SMI_PROFILES);
        this.cliProfiles = cliList(this.argv, SMI_PROFILES_OPTION);
        /** @type {string[]} */
        this.profiles = findLastNotNoneAndEmpty(
            defaultProfiles ?? DEFAULT_PROFILES,
            this.envProfiles,
            this.cliProfiles,
        );

        this.applicationFiles = applicationFiles(this.profiles);
        /** @type {string[]} */
        this.optionalFiles = [
            ...environmentList(this.environment, SMI_OPTIONAL_CONFIG_FILES),
            ...cliList(this.argv, SMI_OPTIONAL_CONFIG_FILES_OPTION),
        ];
        /** @type {Array<{path: string, parsed: Object}>} */
        this.loadedFiles = this.existingFiles().map((filePath) => ({
            path: filePath,
            parsed: parseFile(filePath, this.environment),
        }));
        this.fileConfiguration = mergeConfig(
            this.loadedFiles.map((file) => file.parsed),
        );

        this.environmentOverrideList = overrides.environmentOverrides(
            this.fileConfiguration,
            this.environment,
            overrideRootKeys,
        );
        const withEnvironment = overrides.applyOverrides(
            this.fileConfiguration,
            this.environmentOverrideList,
        );
        this.cliOverrideList = overrides.cliOverrides(
            withEnvironment,
            this.argv,
            overrideRootKeys,
        );
        /** @type {Record<string, unknown>} */
        this.configuration = overrides.applyOverrides(
            withEnvironment,
            this.cliOverrideList,
        );

        /** `{ "smi.server.port": 9090 }` - what the environment changed. */
        this.environmentOverrides = overrides.toDottedObject(
            this.environmentOverrideList,
        );
        /** `{ "smi.server.port": 9091 }` - what the command line changed. */
        this.cliOverrides = overrides.toDottedObject(this.cliOverrideList);

        /** @type {string} */
        this.name =
            overrides.findOptionValue(this.argv, SMI_NAME_OPTION) ||
            this.environment[SMI_NAME] ||
            overrides.getIn(this.configuration, ["application", "name"]) ||
            "default";
    }

    existingFiles() {
        const candidates = [
            ...this.configPaths.flatMap((directory) =>
                this.applicationFiles.map((fileName) =>
                    path.join(directory, fileName),
                ),
            ),
            ...this.optionalFiles,
        ];
        return candidates.filter(isFile);
    }

    /**
     * A value by dotted path (`"smi.server.port"`) or key sequence;
     * `defaultValue` when absent or `null`.
     * @param {string | Iterable<string>} keyPath
     * @param {unknown} [defaultValue]
     * @returns {unknown}
     */
    get(keyPath, defaultValue = undefined) {
        const keys =
            typeof keyPath === "string" ? keyPath.split(".") : [...keyPath];
        const value = overrides.getIn(this.configuration, keys);
        return value === undefined || value === null ? defaultValue : value;
    }

    /**
     * A JSON-friendly summary: name, profiles, paths, loaded files, configuration.
     * @returns {Record<string, unknown>}
     */
    asDict() {
        return {
            name: this.name,
            profiles: this.profiles,
            configPaths: this.configPaths,
            loadedFiles: this.loadedFiles.map((file) => file.path),
            environmentOverrides: this.environmentOverrides,
            cliOverrides: this.cliOverrides,
            configuration: this.configuration,
        };
    }
}
