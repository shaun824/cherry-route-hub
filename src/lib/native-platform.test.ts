import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNativePlatform } from "./native-platform";

describe("native platform detection", () => {
  it("returns false during SSR and on the normal website", () => {
    assert.equal(isNativePlatform(), false);
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    try { assert.equal(isNativePlatform(), false); } finally { Reflect.deleteProperty(globalThis, "window"); }
  });
  it("returns true only when Capacitor explicitly reports a native platform", () => {
    for (const native of [false, true]) {
      Object.defineProperty(globalThis, "window", { value: { Capacitor: { isNativePlatform: () => native } }, configurable: true });
      try { assert.equal(isNativePlatform(), native); } finally { Reflect.deleteProperty(globalThis, "window"); }
    }
  });
});