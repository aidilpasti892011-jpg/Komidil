/** Utilities and limits shared by browser and server code. Keep this file free of server imports. */
export const COLLECTION_NAME_MAX = 50;
export const COLLECTION_DESC_MAX = 200;
export const MAX_COLLECTIONS = 20;
export const MAX_ITEMS = 100;

/** Normalize collection names. Database constraints remain the final authority. */
export function cleanName(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, COLLECTION_NAME_MAX);
}

export function cleanDesc(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, COLLECTION_DESC_MAX);
}
