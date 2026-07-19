/*!
 * Module A
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

/**
 * Builds the greeting message published by module-a.
 * @returns {string} The message from module-a.
 */
export function createMessageFromA() {
    return "message from module-a";
}

/**
 * Logs and returns module-a's foo message.
 * @returns {string} The foo message.
 */
export function foo() {
    const message = "foo() from module-a";
    console.log(message);
    return message;
}

/**
 * Builds a descriptor object identifying module-a and its message.
 * @returns {{module: string, message: string}} The module descriptor.
 */
export function createDescriptorFromA() {
    return {
        module: "a",
        message: createMessageFromA(),
    };
}
