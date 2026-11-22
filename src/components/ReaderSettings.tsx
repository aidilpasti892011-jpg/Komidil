"use client";

import { useEffect, useRef } from "react";
import {
  MODES,
  MODE_LABEL,
  WIDTHS,
  WIDTH_LABEL,
  type ReaderSettings,
} from "@/lib/reader-settings";

type Props = {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  onClose: () => void;
  onFullscreen: () => void;
  onReport: () => void;
};

function Segmented<T extends string>({
  label,
  value,
  options,
  labels,
  onPick,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onPick: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onPick(o)}
          className={`flex-1 rounded-xl border px-2 py-2 text-[13px] font-bold transition ${
            value === o ? "border-brand bg-brand text-white" : "border-line bg-bg text-[#ccc]"
          }`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function Switch({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 flex-none rounded-full transition ${on ? "bg-brand" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

const sectionTitle = "mb-2 text-[12px] font-extrabold tracking-wide text-gold";

export default function ReaderSettingsSheet({ settings, onChange, onClose, onFullscreen, onReport }: Props) {
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan membaca"
        className="relative max-h-[85dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[22px] border border-b-0 border-line bg-card px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Pengaturan Membaca</h2>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-1.5 text-[13px] font-bold"
          >
            Selesai
          </button>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className={sectionTitle}>MODE BACA</h3>
            <Segmented
              label="Mode baca"
              value={settings.mode}
              options={MODES}
              labels={MODE_LABEL}
              onPick={(mode) => onChange({ mode })}
            />
            <p className="mt-1.5 text-xs text-mute">
              {settings.mode === "scroll"
                ? "Gulir ke bawah terus, cocok untuk webtoon dan manhwa."
                : "Satu gambar per layar. Ketuk sisi layar untuk pindah halaman, ketuk tengah untuk menu."}
            </p>
          </section>

          {settings.mode === "page" && (
            <section>
              <Switch
                label="Arah baca kanan ke kiri"
                hint="Untuk manga. Zona ketuk kiri dan kanan ditukar."
                on={settings.rtl}
                onToggle={(rtl) => onChange({ rtl })}
              />
            </section>
          )}

          <section>
            <h3 className={sectionTitle}>LEBAR GAMBAR</h3>
            <Segmented
              label="Lebar gambar"
              value={settings.width}
              options={WIDTHS}
              labels={WIDTH_LABEL}
              onPick={(width) => onChange({ width })}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12px] font-extrabold tracking-wide text-gold">KECERAHAN</h3>
              <span className="text-xs text-mute">{settings.brightness}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              step={5}
              value={settings.brightness}
              onChange={(e) => onChange({ brightness: Number(e.target.value) })}
              aria-label="Kecerahan gambar"
              className="h-6 w-full accent-[#D71920]"
            />
            <p className="mt-0.5 text-xs text-mute">Meredupkan gambar saja, tidak mengubah kecerahan layar.</p>
          </section>

          <section>
            <Switch
              label="Auto lanjut chapter"
              hint="Di akhir chapter, hitung mundur 6 detik lalu buka chapter berikutnya."
              on={settings.autoNext}
              onToggle={(autoNext) => onChange({ autoNext })}
            />
          </section>

          <section className="flex gap-2">
            <button
              type="button"
              onClick={onFullscreen}
              className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px] font-bold"
            >
              Layar penuh
            </button>
            <button
              type="button"
              onClick={onReport}
              className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[13px] font-bold"
            >
              Lapor gambar rusak
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
