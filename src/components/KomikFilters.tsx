"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconSearch } from "./Icons";
import { createClient } from "@/lib/supabase/client";
import {
  COMIC_STATUSES,
  COMIC_TYPES,
  MAX_GENRE_FILTER,
  RATING_MIN_OPTIONS,
  SORT_KEYS,
  SORT_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type Genre,
} from "@/lib/types";

type Suggestion = { slug: string; title: string; type: string };

const RECENT_KEY = "komidil_recent_q";
const chip = (on: boolean) =>
  `flex-none rounded-full border px-3.5 py-1.5 text-[13px] transition ${
    on ? "border-brand bg-brand text-white" : "border-line bg-card text-[#ccc]"
  }`;
const sel = "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-[15px] text-white";

const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
};
const writeRecent = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* penyimpanan penuh / diblokir: abaikan */
  }
};

export default function KomikFilters({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [focus, setFocus] = useState(false);
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const first = useRef(true);
  const reqId = useRef(0);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.delete("n"); // reset "muat lebih banyak" setiap filter berubah
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  };
  const toggle = (k: string, v: string) => set({ [k]: sp.get(k) === v ? "" : v });

  // pencarian: tunggu user berhenti mengetik
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ q: q.trim() }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // saran saat mengetik (minimal 2 huruf); respons lama diabaikan
  useEffect(() => {
    const term = q.trim();
    if (!focus || term.length < 2) {
      setSugg([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("suggest_comics", { p_q: term });
      if (id === reqId.current) setSugg(Array.isArray(data) ? (data as Suggestion[]) : []);
    }, 220);
    return () => clearTimeout(t);
  }, [q, focus]);

  useEffect(() => {
    if (focus) setRecent(readRecent());
  }, [focus]);

  const remember = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    writeRecent([t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())]);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    remember(q);
    setFocus(false);
    set({ q: q.trim() });
  };
  const pick = (term: string) => {
    setQ(term);
    remember(term);
    setFocus(false);
    set({ q: term });
  };

  const type = sp.get("type") ?? "";
  const picked = (sp.get("genre") ?? "").split(",").filter(Boolean);
  const matchAll = sp.get("gm") === "all";
  const rmin = sp.get("rmin") ?? "";
  const hasQ = Boolean((sp.get("q") ?? "").trim());
  const defSort = hasQ ? "rel" : "up";
  const sort = sp.get("sort") ?? defSort;
  const active = [type, sp.get("status"), picked.length ? "g" : "", rmin].filter(Boolean).length;

  const toggleGenre = (slug: string) => {
    const has = picked.includes(slug);
    if (!has && picked.length >= MAX_GENRE_FILTER) return;
    const list = has ? picked.filter((g) => g !== slug) : [...picked, slug];
    set({ genre: list.join(","), gm: list.length > 1 && matchAll ? "all" : "" });
  };
  const reset = () => set({ type: "", status: "", genre: "", gm: "", rmin: "", sort: "" });

  const showRecent = focus && q.trim().length < 2 && recent.length > 0;
  const showSugg = focus && q.trim().length >= 2;

  return (
    <div>
      <form onSubmit={submit} role="search" className="relative">
        <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input
          value={q}
          maxLength={60}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Cari judul, author, atau artist..."
          aria-label="Cari komik"
          aria-expanded={showRecent || showSugg}
          aria-controls="saran-cari"
          autoComplete="off"
          enterKeyHint="search"
          className="w-full rounded-xl border border-line bg-card py-2.5 pl-11 pr-3.5 text-[15px] text-white placeholder:text-mute"
        />

        {(showRecent || showSugg) && (
          <div id="saran-cari" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line bg-[#101010] shadow-xl">
            {showRecent && (
              <>
                <div className="flex items-center justify-between px-3.5 pb-1 pt-2.5 text-[12px] text-mute">
                  <span>Pencarian terakhir</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      writeRecent([]);
                      setRecent([]);
                    }}
                    className="text-gold"
                  >
                    Hapus
                  </button>
                </div>
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r)}
                    className="block w-full truncate px-3.5 py-2.5 text-left text-[14px] hover:bg-card"
                  >
                    {r}
                  </button>
                ))}
              </>
            )}
            {showSugg && (
              <>
                {sugg.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/komik/${s.slug}`}
                    onClick={() => remember(q)}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px] hover:bg-card"
                  >
                    <span className="truncate">{s.title}</span>
                    <span className="flex-none rounded-[10px] bg-gold px-2 py-0.5 text-[10px] font-extrabold text-black">
                      {TYPE_LABEL[s.type as keyof typeof TYPE_LABEL] ?? s.type}
                    </span>
                  </Link>
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(q.trim())}
                  className="block w-full truncate border-t border-line px-3.5 py-2.5 text-left text-[14px] text-gold"
                >
                  Lihat semua hasil untuk &ldquo;{q.trim()}&rdquo;
                </button>
              </>
            )}
          </div>
        )}
      </form>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1.5">
        <button className={chip(!type)} onClick={() => set({ type: "" })}>Semua</button>
        {COMIC_TYPES.map((t) => (
          <button key={t} className={chip(type === t)} onClick={() => toggle("type", t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {genres.length > 0 && (
        <>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1.5" role="group" aria-label="Genre (bisa pilih sampai 5)">
            {genres.map((g) => (
              <button key={g.id} className={chip(picked.includes(g.slug))} aria-pressed={picked.includes(g.slug)} onClick={() => toggleGenre(g.slug)}>
                {g.name}
              </button>
            ))}
          </div>
          {picked.length > 1 && (
            <label className="mt-1 flex items-center gap-2 text-[13px] text-[#ccc]">
              <input
                type="checkbox"
                checked={matchAll}
                onChange={(e) => set({ gm: e.target.checked ? "all" : "" })}
                className="h-4 w-4 accent-[#D71920]"
              />
              Harus cocok semua genre
            </label>
          )}
        </>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <select className={sel} aria-label="Status" value={sp.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}>
          <option value="">Semua status</option>
          {COMIC_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className={sel} aria-label="Rating minimal" value={rmin} onChange={(e) => set({ rmin: e.target.value })}>
          <option value="">Semua rating</option>
          {RATING_MIN_OPTIONS.filter((r) => r > 0).map((r) => (
            <option key={r} value={r}>Rating {r}+</option>
          ))}
        </select>
      </div>
      <div className="mb-2 mt-2">
        <select className={sel} aria-label="Urutkan" value={sort} onChange={(e) => set({ sort: e.target.value === defSort ? "" : e.target.value })}>
          {SORT_KEYS.filter((s) => s !== "rel" || hasQ).map((s) => (
            <option key={s} value={s}>{SORT_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {active > 0 && (
        <button onClick={reset} className="mb-2 text-[13px] text-gold">
          Reset filter ({active})
        </button>
      )}
    </div>
  );
}
