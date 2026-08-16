const PREFIX = "the-corner:";

function read(key) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) {
    throw new Error(`No value found for key "${key}"`);
  }
  return raw;
}

// Minimal localStorage-backed stand-in for the sandboxed `window.storage`
// API the original artifact was written against (get/set/delete, async).
export const storage = {
  async get(key) {
    return { value: read(key) };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
  },
};
