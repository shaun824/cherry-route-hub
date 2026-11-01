import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isInstalledExperience, isNativePlatform } from "./native-platform";

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

describe("installed app prompts", () => {
  it("hides installation prompts in native apps without browser standalone flags", () => {
    Object.defineProperty(globalThis, "window", { value: { Capacitor: { isNativePlatform: () => true }, navigator: { standalone: false }, matchMedia: () => ({ matches: false }) }, configurable: true });
    try { assert.equal(isInstalledExperience(), true); } finally { Reflect.deleteProperty(globalThis, "window"); }
  });
  it("recognises both home-screen browser modes and leaves ordinary browsers uninstalled", () => {
    for (const [standalone, matches, installed] of [[true, false, true], [false, true, true], [false, false, false]]) {
      Object.defineProperty(globalThis, "window", { value: { navigator: { standalone }, matchMedia: () => ({ matches }) }, configurable: true });
      try { assert.equal(isInstalledExperience(), installed); } finally { Reflect.deleteProperty(globalThis, "window"); }
    }
    assert.equal(isInstalledExperience(), false);
  });
});