#!/usr/bin/env node
/*!
 * setmy.info commons
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * `smi-commons [--smi-config-paths ...] [--smi-profiles ...] [--smi-<key> ...]`
 * prints the resolved configuration as JSON - the same loading every
 * application using this library does, so a deployment can be inspected
 * before the application is started.
 * @module cli
 */

import { Application } from "./config.js";

/**
 * @param {string[]} [argv]
 */
export function main(argv = process.argv.slice(2)) {
    const application = new Application(argv);
    console.log(JSON.stringify(application.asDict(), null, 2));
}

main();
