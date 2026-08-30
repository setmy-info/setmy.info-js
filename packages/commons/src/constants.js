/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * Configuration constants - the same names as `smi_commons.constants`
 * (setmy.info-python), `smi_python_commons.config.constants` and
 * `SetmyInfo.Commons.Config.Constants` (setmy.info-elixir).
 * @module constants
 */

/** Environment variable naming the comma separated config directories. */
export const SMI_CONFIG_PATHS = "SMI_CONFIG_PATHS";

/** Environment variable naming the comma separated active profiles. */
export const SMI_PROFILES = "SMI_PROFILES";

/** Environment variable naming extra, comma separated config files. */
export const SMI_OPTIONAL_CONFIG_FILES = "SMI_OPTIONAL_CONFIG_FILES";

/** Environment variable carrying the application name. */
export const SMI_NAME = "SMI_NAME";

/**
 * The four control variables never act as value overrides: an `smi.profiles`
 * key in someone's YAML must not silently pick up `SMI_PROFILES`, which
 * selects *which files load* rather than carrying a value.
 */
export const RESERVED_ENVIRONMENT_VARIABLES = Object.freeze([
    SMI_CONFIG_PATHS,
    SMI_PROFILES,
    SMI_OPTIONAL_CONFIG_FILES,
    SMI_NAME,
]);

export const SMI_CONFIG_PATHS_OPTION = "--smi-config-paths";
export const SMI_PROFILES_OPTION = "--smi-profiles";
export const SMI_OPTIONAL_CONFIG_FILES_OPTION = "--smi-optional-config-files";
export const SMI_NAME_OPTION = "--smi-name";

/** Base name of the configuration files, as in `application.yml`. */
export const APPLICATION_FILE_PREFIX = "application";

/** In overloading order - a later suffix overrides an earlier one from the same directory. */
export const APPLICATION_FILE_SUFFIXES = Object.freeze(["json", "yml", "yaml"]);

/**
 * `local` is active unless `SMI_PROFILES` or `--smi-profiles` says otherwise:
 * the developer machine (ADR-0041) is the only profile that can be right
 * without being told.
 */
export const DEFAULT_PROFILES = Object.freeze(["local"]);

/** Later path wins. `./test/resources` lets a test run override `./resources`. */
export const DEFAULT_CONFIG_PATHS = Object.freeze([
    "./resources",
    "./test/resources",
]);

/**
 * Only keys under these roots can be overridden from the environment or the
 * CLI (`smi:` in YAML, `SMI_` in the environment, `--smi-` on the command
 * line). `null` means every root key, Spring Boot style - unsafe by default,
 * since a top-level `name:` key would then bind to whatever `$NAME` happens
 * to be in the shell.
 */
export const DEFAULT_OVERRIDE_ROOT_KEYS = Object.freeze(["smi"]);
