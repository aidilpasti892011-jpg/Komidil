"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconSliders } from "./Icons";
import ReaderSettingsSheet from "./ReaderSettings";
import ChapterComments from "@/components/ChapterComments";
import { createClient } from "@/lib/supabase/client";
import type { ReaderImage } from "@/lib/comics";
import {
  DEFAULT_SETTINGS,
  WIDTH_PX,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  type ReaderSettings,
} from "@/lib/reader-settings";

type Ch = { id: string; number: number };
type Props = {
  comicId: string;
  slug: string;
  title: string;
  chapters: Ch[]; // terbaru -> terlama
  current: Ch;
  images: ReaderImage[];
  /** posisi terakhir di chapter ini (hanya kalau login dan belum selesai) */
  resume: { page: number; progress: number } | null;
};

const AUTO_SECS = 6;
const circle =
  "grid h-9 w-9 flex-none place-items-center rounded-full border border-line bg-card text-white";

export default function Reader({ comicId, slug, title, chapters, current, images, resume }: Props) {
  const router = useRouter();
  const n = images.length;
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const resumeIdx = resume && resume.page > 1 && n > 0 ? Math.min(resume.page - 1, n - 1) : -1;
  const state = useRef({
    page: resumeIdx >= 0 ? resumeIdx + 1 : 1,
    progress: resumeIdx >= 0 && resume ? resume.progress : 0,
    dirty: true,
  });

  const [uid, setUid] = useState<string | null>(null);
  const [readingSession, setReadingSession] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const [slide, setSlide] = useState(0); // mode halaman: 0..n-1 = gambar, n = panel akhir
  const [loaded, setLoaded] = useState<Set<string>>(new Set()); // sudah selesai (berhasil atau gagal)
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [endVisible, setEndVisible] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [jump, setJump] = useState<{ idx: number; announce: boolean } | null>(
    resumeIdx >= 0 ? { idx: resumeIdx, announce: true } : null
  );
  const [banner, setBanner] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const sessionStartedAt = useRef<number | null>(null);
  const maxP = useRef(0);
  const claimed = useRef(false);
  const progressSyncBusy = useRef(false);
  const claimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetched = useRef(false);
  const pushed = useRef(false);
  const lastY = useRef(0);
  const prevMode = useRef<string | null>(null);

  const showBadgeToasts = useCallback((badges: { name: string }[], delay = 0) => {
    if (badges.length === 0) return;
    setTimeout(() => {
      setToast(`Badge baru: ${badges[0].name}${badges.length > 1 ? ` +${badges.length - 1}` : ""}`);
      setTimeout(() => setToast(""), 3600);
    }, delay);
  }, []);

  const idx = chapters.findIndex((c) => c.id === current.id);
  const next = idx > 0 ? chapters[idx - 1] : null; // lebih baru
  const prev = idx < chapters.length - 1 ? chapters[idx + 1] : null; // lebih lama
  const href = useCallback((c: Ch) => `/komik/${slug}/${c.number}`, [slug]);
  const mode = settings.mode;

  // ---------- init ----------
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const s = loadSettings();
    settingsRef.current = s;
    setSettings(s);
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    const s = sanitizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = s;
    setSettings(s);
    saveSettings(s);
  }, []);

  // Hitung view. Sah atau tidaknya (1 per user/sesi per chapter per hari) diputuskan database lewat RPC.
  useEffect(() => {
    let sid = "";
    try {
      sid = localStorage.getItem("kd_sid") ?? "";
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(sid)) {
        sid = crypto.randomUUID();
        localStorage.setItem("kd_sid", sid);
      }
    } catch {
      sid = crypto.randomUUID();
    }
    createClient()
      .rpc("track_chapter_view", { p_chapter: current.id, p_session: sid })
      .then(() => {}, () => {});
  }, [current.id]);

  // Sesi XP dibuat database setiap kali halaman chapter dibuka oleh pengguna login.
  // Timestamp dari browser hanya dipakai untuk menjadwalkan percobaan; database tetap memvalidasi durasi.
  useEffect(() => {
    let cancelled = false;
    setReadingSession(null);
    sessionStartedAt.current = null;
    if (!uid) return;

    createClient()
      .rpc("start_reading_session", { p_chapter: current.id })
      .then(({ data, error }) => {
        if (cancelled || error || typeof data !== "string") return;
        sessionStartedAt.current = Date.now();
        setReadingSession(data);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, current.id]);

  // Progress maksimum dikirim sebagai checkpoint ke sesi yang dibuat server.
  // Nilai progress tetap berasal dari interaksi browser dan tidak membuktikan bahwa gambar benar-benar dilihat.
  const syncReadingProgress = useCallback(async () => {
    if (!uid || !readingSession || maxP.current <= 0 || progressSyncBusy.current) return;
    progressSyncBusy.current = true;
    try {
      const { data, error } = await createClient().rpc("record_reading_progress", {
        p_session: readingSession,
        p_progress: Math.min(maxP.current, 1),
      });
      if (!error && data && typeof data === "object") {
        const badges = (data as { badges?: { name: string }[] }).badges;
        if (Array.isArray(badges)) showBadgeToasts(badges);
      }
    } catch {
      // Kegagalan jaringan tidak boleh menjadi unhandled rejection di Reader.
    } finally {
      progressSyncBusy.current = false;
    }
  }, [uid, readingSession, showBadgeToasts]);

  // Heartbeat memperbarui checkpoint dari database. Completion tetap ditolak database
  // sebelum sesi berumur minimal 30 detik dan checkpoint dibuat pada bagian akhir sesi.
  useEffect(() => {
    if (!uid || !readingSession) return;
    const timer = setInterval(() => {
      if (maxP.current > 0) void syncReadingProgress();
    }, 5000);
    return () => clearInterval(timer);
  }, [uid, readingSession, syncReadingProgress]);

  // XP dan reading_log diproses atomik oleh satu RPC database, bukan dua klaim terpisah.
  const tryCompleteReadingSession = useCallback(() => {
    if (!uid || !readingSession || claimed.current || maxP.current < 0.6) return;
    claimed.current = true;
    const started = sessionStartedAt.current ?? Date.now();
    const wait = Math.max(0, 32_000 - (Date.now() - started));

    claimTimer.current = setTimeout(async () => {
      try {
        const sb = createClient();
        const progress = await sb.rpc("record_reading_progress", {
          p_session: readingSession,
          p_progress: Math.min(maxP.current, 1),
        });
        if (progress.error) {
          claimed.current = false;
          return;
        }

        const { data, error } = await sb.rpc("complete_reading_session", { p_session: readingSession });
        if (error || !data || typeof data !== "object") {
          claimed.current = false;
          return;
        }

        const result = data as { xp?: number; badges?: { name: string }[]; accepted?: boolean };
        const gained = Number(result.xp ?? 0);
        const badges = Array.isArray(result.badges) ? result.badges : [];
        if (gained > 0) {
          setToast(`+${gained} XP`);
          setTimeout(() => setToast(""), 2600);
        }
        showBadgeToasts(badges, gained > 0 ? 2800 : 0);
      } catch {
        claimed.current = false;
      }
    }, wait);
  }, [uid, readingSession, showBadgeToasts]);

  useEffect(() => {
    if (readingSession && maxP.current >= 0.6) tryCompleteReadingSession();
  }, [readingSession, tryCompleteReadingSession]);

  useEffect(
    () => () => {
      if (claimTimer.current) clearTimeout(claimTimer.current);
    },
    []
  );

  // simpan riwayat baca (hanya kalau login)
  const save = useCallback(async () => {
    if (!uid || !state.current.dirty) return;
    state.current.dirty = false;
    const { page, progress } = state.current;
    await createClient()
      .from("reading_history")
      .upsert(
        {
          user_id: uid,
          comic_id: comicId,
          chapter_id: current.id,
          page,
          progress: Math.min(Math.max(progress, 0), 1),
        },
        { onConflict: "user_id,comic_id" }
      );
  }, [uid, comicId, current.id]);

  useEffect(() => {
    if (!uid) return;
    save();
    const t = setInterval(save, 4000);
    return () => {
      clearInterval(t);
      save();
    };
  }, [uid, save]);

  // catat progres (dipakai mode scroll dan halaman)
  const track = useCallback(
    (p: number, page: number) => {
      state.current = { page, progress: p, dirty: true };
      if (p > maxP.current) maxP.current = p;
      if (maxP.current > 0) void syncReadingProgress();
      if (maxP.current >= 0.6) tryCompleteReadingSession();
      if (maxP.current >= 0.5 && next && !prefetched.current) {
        prefetched.current = true;
        router.prefetch(href(next));
      }
    },
    [syncReadingProgress, tryCompleteReadingSession, next, router, href]
  );

  // ---------- lompat posisi (lanjut baca / ganti mode) ----------
  useEffect(() => {
    if (!ready || !jump || mode !== "page") return;
    setSlide(jump.idx);
    if (jump.announce) setBanner(jump.idx + 1);
    setJump(null);
  }, [ready, jump, mode]);

  useEffect(() => {
    if (!ready || !jump || mode !== "scroll") return;
    const doJump = () => {
      const el = pageRefs.current[jump.idx];
      if (el && box.current) box.current.scrollTop = el.offsetTop;
      if (jump.announce) setBanner(jump.idx + 1);
      setJump(null);
    };
    const settled = images.slice(0, jump.idx + 1).every((i) => loaded.has(i.id));
    if (settled) {
      doJump();
      return;
    }
    const t = setTimeout(doJump, 6000);
    return () => clearTimeout(t);
  }, [ready, jump, mode, loaded, images]);

  useEffect(() => {
    if (banner === null) return;
    const t = setTimeout(() => setBanner(null), 7000);
    return () => clearTimeout(t);
  }, [banner]);

  // ganti mode di tengah chapter: tetap di halaman yang sama
  useEffect(() => {
    if (!ready) return;
    const pm = prevMode.current;
    prevMode.current = mode;
    if (pm === null || pm === mode || n === 0) return;
    setJump({ idx: Math.max(0, Math.min(state.current.page - 1, n - 1)), announce: false });
  }, [mode, ready, n]);

  // ---------- mode halaman ----------
  useEffect(() => {
    if (!ready || mode !== "page" || jump || n === 0) return;
    const p = slide >= n ? 1 : (slide + 1) / n;
    track(p, Math.min(slide + 1, n));
    if (bar.current) bar.current.style.width = `${p * 100}%`;
    if (box.current) box.current.scrollTop = 0;
    lastY.current = 0;
  }, [slide, ready, mode, jump, n, track]);

  // muat gambar halaman berikutnya lebih dulu
  useEffect(() => {
    if (mode !== "page") return;
    for (let i = slide + 1; i <= slide + 2 && i < n; i++) {
      const im = new Image();
      im.src = images[i].url;
    }
  }, [mode, slide, images, n]);

  const pageNext = useCallback(() => {
    const el = box.current;
    if (!el || slide >= n) return;
    const room = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (room > 12) {
      el.scrollBy({ top: el.clientHeight * 0.85, behavior: "smooth" });
      return;
    }
    setSlide((s) => Math.min(s + 1, n));
    setBarVisible(false);
  }, [slide, n]);

  const pagePrev = useCallback(() => {
    const el = box.current;
    if (!el) return;
    if (el.scrollTop > 12) {
      el.scrollBy({ top: -el.clientHeight * 0.85, behavior: "smooth" });
      return;
    }
    if (slide > 0) {
      setSlide((s) => s - 1);
      setBarVisible(false);
    } else {
      setNote("Ini halaman pertama.");
      setTimeout(() => setNote(""), 2000);
    }
  }, [slide]);

  useEffect(() => {
    if (mode !== "page" || sheet) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["SELECT", "INPUT", "TEXTAREA"].includes(t.tagName)) return;
      setInteracted(true);
      const fwd = settings.rtl ? "ArrowLeft" : "ArrowRight";
      const back = settings.rtl ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        pageNext();
      } else if (e.key === back || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        pagePrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, sheet, settings.rtl, pageNext, pagePrev]);

  // ---------- mode scroll ----------
  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const top = el.scrollTop;

    if (mode === "scroll" && !jump) {
      const p = max > 0 ? top / max : 0;
      if (bar.current) bar.current.style.width = `${p * 100}%`;
      const mid = top + el.clientHeight / 2;
      let page = 1;
      pageRefs.current.forEach((nd, i) => {
        if (nd && nd.offsetTop <= mid) page = i + 1;
      });
      track(p, page);
    }

    // toolbar: sembunyi saat menggulir turun, muncul saat menggulir naik
    const dy = top - lastY.current;
    lastY.current = top;
    if (sheet) return;
    if (top < 48) setBarVisible(true);
    else if (dy > 14) setBarVisible(false);
    else if (dy < -14) setBarVisible(true);
  };

  useEffect(() => {
    const el = endRef.current;
    const root = box.current;
    if (!ready || mode !== "scroll" || !el || !root) return;
    const io = new IntersectionObserver(([e]) => setEndVisible(e.intersectionRatio >= 0.6), {
      root,
      threshold: [0, 0.6, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, mode, n]);

  // ---------- auto lanjut chapter ----------
  const allSettled = n === 0 || loaded.size >= n;
  const atEnd =
    ready && interacted && (mode === "scroll" ? endVisible && allSettled : slide >= n && n > 0);

  useEffect(() => {
    if (!atEnd) setCancelled(false);
  }, [atEnd]);

  useEffect(() => {
    if (!settings.autoNext || !next || !atEnd || cancelled) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_SECS);
    const t = setInterval(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearInterval(t);
  }, [settings.autoNext, next, atEnd, cancelled]);

  useEffect(() => {
    if (countdown !== null && countdown <= 0 && next && !pushed.current) {
      pushed.current = true;
      router.push(href(next));
    }
  }, [countdown, next, router, href]);

  // ---------- aksi ----------
  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()).catch(() =>
      setNote("Layar penuh tidak didukung di perangkat ini.")
    );
  };

  const report = async (img?: ReaderImage) => {
    if (!uid) {
      setNote("Login dulu untuk melapor.");
      return;
    }
    const target = img ?? images.find((i) => i.page === state.current.page);
    if (!target) {
      setNote("Tidak ada gambar untuk dilaporkan.");
      return;
    }
    const { error } = await createClient()
      .from("reports")
      .insert({ reporter_id: uid, target_type: "chapter_image", target_id: target.id, reason: "Gambar rusak", detail: `Halaman ${target.page}` });
    setNote(error ? "Gagal mengirim laporan: " + error.message : "Laporan terkirim, terima kasih.");
  };

  const fromStart = () => {
    setBanner(null);
    if (mode === "page") setSlide(0);
    else if (box.current) box.current.scrollTop = 0;
  };

  const markDone = (id: string) =>
    setLoaded((s) => (s.has(id) ? s : new Set(s).add(id)));

  const isUi = (t: EventTarget | null) =>
    t instanceof Element && Boolean(t.closest("button,a,select,input,[role=dialog]"));

  const onContentClick = (e: React.MouseEvent) => {
    if (isUi(e.target)) return;
    if (mode === "scroll") {
      setBarVisible((v) => !v);
      return;
    }
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) (settings.rtl ? pageNext : pagePrev)();
    else if (x > 0.7) (settings.rtl ? pagePrev : pageNext)();
    else setBarVisible((v) => !v);
  };

  const maxW = WIDTH_PX[settings.width];
  const colStyle = maxW ? { maxWidth: `${maxW}px` } : undefined;
  const shown = Math.min(Math.max(state.current.page, 1), Math.max(n, 1));
  const pageLabel = mode === "page" ? Math.min(slide + 1, n) : shown;
  const dim = settings.brightness < 100 ? { filter: `brightness(${settings.brightness / 100})` } : undefined;
  const eagerUpTo = jump ? jump.idx : 1;

  const endPanel = (
    <div ref={endRef} className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-[12px] font-extrabold tracking-wide text-gold">SELESAI</p>
      <h2 className="text-xl font-bold">Chapter {current.number} selesai</h2>
      {next ? (
        countdown !== null ? (
          <div className="w-full rounded-2xl border border-line bg-card p-3.5">
            <p className="text-sm">
              Lanjut ke Chapter {next.number} dalam <b className="text-gold">{Math.max(countdown, 0)}</b> detik
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
                style={{ width: `${((AUTO_SECS - Math.max(countdown, 0)) / AUTO_SECS) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setCancelled(true)}
              className="mt-2.5 rounded-3xl border border-line px-4 py-1.5 text-[13px] font-bold"
            >
              Batal
            </button>
          </div>
        ) : null
      ) : (
        <p className="text-sm text-mute">Ini chapter terbaru. Ikuti komiknya supaya dikabari saat ada chapter baru.</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {prev && <Link href={href(prev)} className="rounded-3xl border border-line bg-card px-5 py-2.5 text-sm font-bold">Sebelumnya</Link>}
        {next ? (
          <Link href={href(next)} className="rounded-3xl bg-brand px-5 py-2.5 text-sm font-bold">Berikutnya</Link>
        ) : (
          <Link href={`/komik/${slug}`} className="rounded-3xl bg-brand px-5 py-2.5 text-sm font-bold">Kembali ke detail</Link>
        )}
      </div>
      {note && <p role="status" className="text-xs text-gold">{note}</p>}
    </div>
  );

  const brokenBox = (img: ReaderImage) => (
    <div className="grid place-items-center gap-2.5 bg-card px-4 py-14 text-center text-sm text-mute">
      <span>Gambar halaman {img.page} gagal dimuat.</span>
      <button type="button" onClick={() => report(img)} className="rounded-3xl border border-line px-4 py-2 font-bold text-white">
        Laporkan gambar rusak
      </button>
    </div>
  );

  return (
    <div
      ref={box}
      onScroll={onScroll}
      onPointerDown={() => setInteracted(true)}
      onWheel={() => setInteracted(true)}
      onTouchStart={() => setInteracted(true)}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black"
    >
      {/* toolbar */}
      <div
        inert={!barVisible}
        className={`fixed inset-x-0 top-0 z-20 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200 ${
          barVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div ref={bar} className="h-[3px] w-0 bg-gradient-to-r from-brand to-gold" />
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <Link href={`/komik/${slug}`} aria-label="Kembali ke detail" className={circle}>
            <IconChevronLeft width={18} height={18} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <b className="truncate text-sm">{title}</b>
            <select
              aria-label="Pilih chapter"
              value={current.id}
              onChange={(e) => {
                const c = chapters.find((x) => x.id === e.target.value);
                if (c) router.push(href(c));
              }}
              className="rounded-xl border border-line bg-card px-2.5 py-1.5 text-[13px] text-white"
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>Chapter {c.number}</option>
              ))}
            </select>
          </div>
          {prev ? (
            <Link href={href(prev)} aria-label="Chapter sebelumnya" className={circle}><IconChevronLeft width={18} height={18} /></Link>
          ) : (
            <span className={`${circle} opacity-35`}><IconChevronLeft width={18} height={18} /></span>
          )}
          {next ? (
            <Link href={href(next)} aria-label="Chapter berikutnya" className={circle}><IconChevronRight width={18} height={18} /></Link>
          ) : (
            <span className={`${circle} opacity-35`}><IconChevronRight width={18} height={18} /></span>
          )}
          <button type="button" onClick={() => setSheet(true)} aria-label="Pengaturan membaca" className={circle}>
            <IconSliders width={18} height={18} />
          </button>
        </div>
      </div>

      {/* isi */}
      {ready && (
        <div onClick={onContentClick} style={dim}>
          {n === 0 ? (
            <p className="px-6 py-24 text-center text-mute">Chapter ini belum punya gambar.</p>
          ) : mode === "scroll" ? (
            <>
              <div aria-hidden="true" className="h-[calc(84px+env(safe-area-inset-top))]" />
              {images.map((img, i) => {
                const done = loaded.has(img.id);
                const ratio = img.w && img.h ? `${img.w} / ${img.h}` : undefined;
                return (
                  <div
                    key={img.id}
                    ref={(nd) => { pageRefs.current[i] = nd; }}
                    className="mx-auto"
                    style={{
                      ...colStyle,
                      ...(!done ? { aspectRatio: ratio, minHeight: ratio ? undefined : "60vh" } : null),
                    }}
                  >
                    {broken.has(img.id) ? (
                      brokenBox(img)
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={`Halaman ${img.page}`}
                        loading={i <= eagerUpTo ? "eager" : "lazy"}
                        decoding="async"
                        onLoad={() => markDone(img.id)}
                        onError={() => {
                          setBroken((s) => new Set(s).add(img.id));
                          markDone(img.id);
                        }}
                        className="block w-full"
                      />
                    )}
                  </div>
                );
              })}
              {endPanel}
              <ChapterComments chapterId={current.id} />
              <div aria-hidden="true" className="h-[calc(30px+env(safe-area-inset-bottom))]" />
            </>
          ) : slide < n ? (
            <div className="mx-auto flex min-h-[100dvh] items-center justify-center" style={colStyle}>
              {broken.has(images[slide].id) ? (
                brokenBox(images[slide])
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={images[slide].id}
                  src={images[slide].url}
                  alt={`Halaman ${images[slide].page}`}
                  decoding="async"
                  onLoad={() => markDone(images[slide].id)}
                  onError={() => setBroken((s) => new Set(s).add(images[slide].id))}
                  className="block w-full"
                />
              )}
            </div>
          ) : (
            <>
              <div className="grid min-h-[100dvh] place-items-center">{endPanel}</div>
              <ChapterComments chapterId={current.id} />
            </>
          )}
        </div>
      )}

      {sheet && (
        <ReaderSettingsSheet
          settings={settings}
          onChange={update}
          onClose={() => setSheet(false)}
          onFullscreen={fullscreen}
          onReport={() => {
            setSheet(false);
            report();
          }}
        />
      )}

      {/* penunjuk halaman */}
      {ready && n > 0 && (mode === "page" || barVisible) && !sheet && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-bg/85 px-3 py-1 text-xs font-bold tabular-nums text-[#ddd] backdrop-blur"
        >
          {pageLabel} / {n}
        </div>
      )}

      {banner !== null && !sheet && (
        <div
          role="status"
          className="fixed bottom-[calc(52px+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-line bg-card px-4 py-2 text-[13px] shadow-lg"
        >
          <span>Lanjut dari halaman {banner}</span>
          <button type="button" onClick={fromStart} className="font-bold text-gold">Dari awal</button>
        </div>
      )}

      {note && mode === "page" && slide < n && (
        <p role="status" className="fixed bottom-[calc(52px+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-card px-4 py-2 text-xs text-gold">
          {note}
        </p>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full border border-gold/40 bg-card px-4 py-2 text-sm font-bold text-gold shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
