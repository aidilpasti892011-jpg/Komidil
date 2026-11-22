export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function checkPassword(p: string): string | null {
  if (p.length < 8) return "Password minimal 8 karakter.";
  if (p.length > 72) return "Password maksimal 72 karakter.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password harus mengandung huruf dan angka.";
  return null;
}

/** Hanya path internal; cegah open-redirect. */
export function safeNext(v: FormDataEntryValue | string | null | undefined, fallback = "/profil"): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}
