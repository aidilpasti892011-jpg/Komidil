"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlay, IconStar } from "./Icons";
import { TYPE_LABEL, type ComicCardData } from "@/lib/types";

export default function Hero({ items }: { items: ComicCardData[] }) {
  const [i, setI] = useState(0);
  const n = items.length;

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, i]);

  if (n === 0) return null;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <section className="relative -mx-3.5 mb-4 h-[340px] overflow-hidden md:mx-0 md:h-[400px] md:rounded-[18px]">
      {items.map((c, k) => (
        <div
          key={c.id}
          aria-hidden={k !== i}
          className={`absolute inset-0 flex items-end transition-opacity duration-700 ${
            k === i ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            background: `linear-gradient(to top,#090909 8%,transparent 70%),linear-gradient(135deg,hsl(${c.cover_hue},70%,38%),hsl(${(c.cover_hue + 45) % 360},60%,14%))`,
          }}
        >
          <div className="max-w-[560px] px-4 pb-7">
            <span className="rounded-[10px] bg-gold px-2 py-0.5 text-[11px] font-extrabold text-black">
              {TYPE_LABEL[c.type]}
            </span>
            <h1 className="mb-1 mt-2 text-[28px] font-bold leading-tight md:text-4xl">{c.title}</h1>
            <p className="my-1 flex items-center gap-1 text-[13px] text-[#d0d0d0]">
              <IconStar className="text-gold" /> {c.rating_avg.toFixed(1)} · {c.genres.join(" · ")} · Ch{" "}
              {c.latest_chapter_number ?? c.chapter_count}
            </p>
            <p className="my-1 line-clamp-2 text-[13px] text-[#d0d0d0]">{c.synopsis}</p>
            <Link
              href={`/komik/${c.slug}`}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-3xl bg-brand px-5 py-2.5 text-sm font-bold transition active:scale-95"
            >
              <IconPlay /> Baca Sekarang
            </Link>
          </div>
        </div>
      ))}
      {n > 1 && (
        <>
          <button
            aria-label="Sebelumnya"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white"
          >
            <IconChevronLeft />
          </button>
          <button
            aria-label="Berikutnya"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white"
          >
            <IconChevronRight />
          </button>
        </>
      )}
    </section>
  );
}
