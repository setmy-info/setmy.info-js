/*!
 * Module A
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

export function createMessageFromA() {
  return "message from module-a";
}

export function foo() {
  const message = "foo() from module-a";
  console.log(message);
  return message;
}

export function createDescriptorFromA() {
  return {
    module: "a",
    message: createMessageFromA(),
  };
}

