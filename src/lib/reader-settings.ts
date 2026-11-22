// Pengaturan Reader Premium. Disimpan di browser (localStorage), tanpa akun.
export type ReaderMode = "scroll" | "page";
export type ReaderWidth = "narrow" | "medium" | "wide" | "full";

export type ReaderSettings = {
  mode: ReaderMode;
  width: ReaderWidth;
  /** 40..100 (persen) */
  brightness: number;
  autoNext: boolean;
  /** mode halaman: kanan ke kiri (manga) */
  rtl: boolean;
};

export const STORAGE_KEY = "kd_reader_v1";

export const DEFAULT_SETTINGS: ReaderSettings = {
  mode: "scroll",
  width: "medium",
  brightness: 100,
  autoNext: false,
  rtl: false,
};

export const MODE_LABEL: Record<ReaderMode, string> = { scroll: "Scroll", page: "Halaman" };
export const WIDTH_LABEL: Record<ReaderWidth, string> = {
  narrow: "Sempit",
  medium: "Sedang",
  wide: "Lebar",
  full: "Penuh",
};
export const WIDTH_PX: Record<ReaderWidth, number | null> = {
  narrow: 520,
  medium: 720,
  wide: 960,
  full: null,
};
export const MODES: ReaderMode[] = ["scroll", "page"];
export const WIDTHS: ReaderWidth[] = ["narrow", "medium", "wide", "full"];

export function sanitizeSettings(raw: unknown): ReaderSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = Number(o.brightness);
  return {
    mode: MODES.includes(o.mode as ReaderMode) ? (o.mode as ReaderMode) : DEFAULT_SETTINGS.mode,
    width: WIDTHS.includes(o.width as ReaderWidth) ? (o.width as ReaderWidth) : DEFAULT_SETTINGS.width,
    brightness: Number.isFinite(b) ? Math.min(100, Math.max(40, Math.round(b / 5) * 5)) : 100,
    autoNext: o.autoNext === true,
    rtl: o.rtl === true,
  };
}

export function loadSettings(): ReaderSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return sanitizeSettings(s ? JSON.parse(s) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* mode privat / penyimpanan penuh: abaikan, pengaturan berlaku untuk sesi ini saja */
  }
}
