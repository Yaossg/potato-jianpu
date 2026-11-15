/** Read current preferences, copying a legacy value only when no new value exists. */
export function readStoredValue(key: string): string | null {
  try {
    const storage = window.localStorage;
    const current = storage.getItem(key);
    if (current !== null) return current;
    const legacyKey = key.replace(/^potato-jianpu-/, "modern-jianpu-markup-");
    if (legacyKey === key) return null;
    const legacy = storage.getItem(legacyKey);
    if (legacy !== null) {
      try {
        storage.setItem(key, legacy);
      } catch {
        // Still restore the draft or preference if storage is full or read-only.
      }
    }
    return legacy;
  } catch {
    return null;
  }
}
