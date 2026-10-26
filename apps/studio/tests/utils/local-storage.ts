import { vi } from "vitest";

/** An in-memory `localStorage` whose methods are spies; `store` exposes the raw entries. */
export function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    store,
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}
