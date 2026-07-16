/*!
 * Module B
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

export function createMessageFromB() {
  return "message from module-b";
}

export function bar() {
  const message = "bar() from module-b";
  console.log(message);
  return message;
}

export function createDescriptorFromB() {
  return {
    module: "b",
    message: createMessageFromB(),
  };
}

