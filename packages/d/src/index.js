/*!
 * Module D
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

import {
    createDescriptorFromC,
    createMessageFromC,
} from "@setmy-info/demo-module-c";

export function qux() {
    const message = "qux() from module-d";
    console.log(message);
    return message;
}

export function createDescriptorFromD() {
    return {
        module: "d",
        dependency: createDescriptorFromC(),
    };
}

export function createMessageFromD() {
    return `${createMessageFromC()} -> module-d`;
}
