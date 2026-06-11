// Node.js 25 ships a built-in localStorage global that vitest's jsdom
// environment does not override (localStorage is absent from vitest's
// KEYS allow-list so populateGlobal() skips it when the key already
// exists on globalThis). Re-wire globalThis.localStorage to jsdom's
// proper Storage instance so that the full Web Storage API is available.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsdom = (globalThis as any).jsdom;
if (jsdom?.window?.localStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    get: () => jsdom.window.localStorage,
    configurable: true,
  });
}
