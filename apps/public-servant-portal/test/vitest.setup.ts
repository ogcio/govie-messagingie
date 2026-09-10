// Vitest setup file
// This file runs before all tests
import "@testing-library/jest-dom/vitest"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

// Node >= 25 defines a global `localStorage` getter that returns undefined
// unless --localstorage-file is passed, and it shadows jsdom's implementation
// in the vitest jsdom environment. Restore a working Storage when that happens.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(String(key)) ?? null,
      setItem: (key: string, value: string) =>
        void store.set(String(key), String(value)),
      removeItem: (key: string) => void store.delete(String(key)),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
    },
  })
}
