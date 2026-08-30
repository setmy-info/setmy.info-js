/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

export type Environment = Record<string, string | undefined>;
export type Configuration = Record<string, unknown>;
export type ConfigPath = string[];
export interface Override {
    path: ConfigPath;
    value: unknown;
}

export interface ApplicationOptions {
    /** Replaces `constants.DEFAULT_CONFIG_PATHS`. */
    configPaths?: readonly string[];
    /** Replaces `constants.DEFAULT_PROFILES`. */
    defaultProfiles?: readonly string[];
    /** Replaces `constants.DEFAULT_OVERRIDE_ROOT_KEYS`; `null` = every root key. */
    overrideRootKeys?: readonly string[] | null;
    /** Replaces `process.env`. */
    environment?: Environment;
}

export interface LoadedFile {
    path: string;
    parsed: Configuration;
}

export interface ApplicationSummary {
    name: string;
    profiles: string[];
    configPaths: string[];
    loadedFiles: string[];
    environmentOverrides: Record<string, unknown>;
    cliOverrides: Record<string, unknown>;
    configuration: Configuration;
}

/** The loaded configuration and every intermediate step that produced it. */
export class Application {
    constructor(argv?: readonly string[], options?: ApplicationOptions);

    readonly argv: string[];
    readonly environment: Environment;
    readonly overrideRootKeys: readonly string[] | null;
    readonly envConfigPaths: string[];
    readonly cliConfigPaths: string[];
    readonly configPaths: string[];
    readonly envProfiles: string[];
    readonly cliProfiles: string[];
    readonly profiles: string[];
    readonly applicationFiles: string[];
    readonly optionalFiles: string[];
    readonly loadedFiles: LoadedFile[];
    readonly fileConfiguration: Configuration;
    readonly environmentOverrideList: Override[];
    readonly cliOverrideList: Override[];
    readonly environmentOverrides: Record<string, unknown>;
    readonly cliOverrides: Record<string, unknown>;
    readonly configuration: Configuration;
    readonly name: string;

    /** A value by dotted path (`"smi.server.port"`) or key sequence; `defaultValue` when absent or `null`. */
    get<T = unknown>(keyPath: string | Iterable<string>, defaultValue?: T): T;
    asDict(): ApplicationSummary;
}

export namespace constants {
    const SMI_CONFIG_PATHS: string;
    const SMI_PROFILES: string;
    const SMI_OPTIONAL_CONFIG_FILES: string;
    const SMI_NAME: string;
    const RESERVED_ENVIRONMENT_VARIABLES: readonly string[];
    const SMI_CONFIG_PATHS_OPTION: string;
    const SMI_PROFILES_OPTION: string;
    const SMI_OPTIONAL_CONFIG_FILES_OPTION: string;
    const SMI_NAME_OPTION: string;
    const APPLICATION_FILE_PREFIX: string;
    const APPLICATION_FILE_SUFFIXES: readonly string[];
    const DEFAULT_PROFILES: readonly string[];
    const DEFAULT_CONFIG_PATHS: readonly string[];
    const DEFAULT_OVERRIDE_ROOT_KEYS: readonly string[];
}

export namespace strings {
    function splitAndTrim(
        value: string | undefined | null,
        separator?: string,
    ): string[];
    function toBoolean(value: string, defaultValue: boolean): boolean;
    function toInt(value: string, defaultValue: number): number;
    function toFloat(value: string, defaultValue: number): number;
    function findNamedPlaceholders(text: string): string[];
    function replaceNamedPlaceholder(
        text: string,
        name: string,
        value: string,
    ): string;
    function resolvePlaceholders(text: string, variables: Environment): string;
}

export namespace overrides {
    function isMapping(value: unknown): value is Configuration;
    function leafPaths(
        config: Configuration,
        rootKeys: readonly string[] | null | undefined,
    ): ConfigPath[];
    function environmentVariableNames(path: ConfigPath): string[];
    function cliOptionNames(path: ConfigPath): string[];
    function allCliOptionNames(
        config: Configuration,
        rootKeys?: readonly string[] | null,
    ): string[];
    function getIn(
        config: unknown,
        path: Iterable<string>,
        defaultValue?: unknown,
    ): unknown;
    function findOptionValue(
        argv: readonly string[],
        name: string,
    ): string | undefined;
    function coerceLike(current: unknown, raw: string): unknown;
    function collect(
        config: Configuration,
        rootKeys: readonly string[] | null | undefined,
        namesBuilder: (path: ConfigPath) => Iterable<string>,
        lookup: (name: string) => string | undefined,
    ): Override[];
    function environmentOverrides(
        config: Configuration,
        environment: Environment,
        rootKeys?: readonly string[] | null,
    ): Override[];
    function cliOverrides(
        config: Configuration,
        argv: readonly string[],
        rootKeys?: readonly string[] | null,
    ): Override[];
    function applyOverrides(
        config: Configuration,
        overrides: Override[],
    ): Configuration;
    function toDottedObject(overrides: Override[]): Record<string, unknown>;
}

export namespace config {
    function environmentList(environment: Environment, name: string): string[];
    function cliList(argv: readonly string[], name: string): string[];
    function findLastNotNoneAndEmpty(
        ...values: (readonly string[] | undefined | null)[]
    ): string[];
    function mergeDicts(left: unknown, right: unknown): unknown;
    function mergeConfig(contents: Iterable<Configuration>): Configuration;
    function applicationFiles(profiles: readonly string[]): string[];
    function parseFile(
        filePath: string,
        environment: Environment,
    ): Configuration;
}
