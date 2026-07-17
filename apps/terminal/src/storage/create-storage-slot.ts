interface StorageSlot<T> {
  load: () => T;
  store: (value: T) => void;
}

export const createStorageSlot = <T>(
  key: string,
  defaultValue: T,
  deserialize?: (raw: string) => T,
): StorageSlot<T> => ({
  load: (): T => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === "") return defaultValue;
      return deserialize ? deserialize(raw) : (raw as unknown as T);
    } catch {
      return defaultValue;
    }
  },
  store: (value: T): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      /* localStorage unavailable */
    }
  },
});
