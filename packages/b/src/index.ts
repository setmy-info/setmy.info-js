/*!
 * Module B
 * Copyright (c) 2026 Imre Tabur
 * Licensed under the MIT License
 */

export interface ModuleBDescriptor {
  module: "b";
  message: string;
}

export function createMessageFromB(): string {
  return "message from module-b";
}

export function bar(): string {
  const message = "bar() from module-b";
  console.log(message);
  return message;
}

export function createDescriptorFromB(): ModuleBDescriptor {
  return {
    module: "b",
    message: createMessageFromB(),
  };
}
