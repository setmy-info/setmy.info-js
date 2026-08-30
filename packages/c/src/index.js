/*!
 * Module C
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

import { createDescriptorFromA } from "@setmy-info/demo-module-a";
import { createDescriptorFromB } from "@setmy-info/demo-module-b";

export function baz() {
    const message = "baz() from module-c";
    console.log(message);
    return message;
}

export function createDescriptorFromC() {
    return {
        module: "c",
        dependencies: [createDescriptorFromA(), createDescriptorFromB()],
    };
}

export function createMessageFromC() {
    return `${createDescriptorFromA().message} + ${createDescriptorFromB().message} -> module-c`;
}
