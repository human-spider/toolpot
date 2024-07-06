/**
 * Saves value in the session storage, so it can be retrieved later by its key
 * 
 * @param {string} key - The key under which the value will be stored.
 * @param {string} value - The value to be stored.
 * @returns {string} A success message indicating the item was stored.
 */
export function sessionStorageSetItem(key: string, value: string): string {
  sessionStorage.setItem(key, value);
  return `successfully stored item to session storage`;
}

/**
 * Retrieves an item from the local storage.
 * 
 * @param {string} key - The key of the item to retrieve.
 * @returns {string | null} The value associated with the key if found, or null if not found.
 */
export function sessionStorageGetItem(key: string): string | null {
  return sessionStorage.getItem(key);
}