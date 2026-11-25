"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlay,
  IconStar,
} from "./Icons";
import { TYPE_LABEL, type ComicCardData } from "@/lib/types";

export default function Hero({ items }: { items: ComicCardData[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const n = items.length;

  useEffect(() => {
    if (n < 2 || paused) return;

    const timer = window.setInterval(() => {
      setI((v) => (v + 1) % n);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [n, paused]);

  if (n === 0) return null;

  const go = (d: number) => {
    setI((v) => (v + d + n) % n);
  };

  return (
    <section
      className="relative -mx-3.5 mb-4 aspect-[4/5] max-h-[70vh] overflow-hidden rounded-xl md:mx-0 md:aspect-video md:rounded-[18px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined) {
          const diff = end - start;
          if (Math.abs(diff) > 45) go(diff > 0 ? -1 : 1);
        }
        touchStartX.current = null;
        setPaused(false);
      }}
      onTouchCancel={() => {
        touchStartX.current = null;
        setPaused(false);
      }}
    >
      {items.map((c, k) => (
        <div
          key={c.id}
          aria-hidden={k !== i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            k === i ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{ backgroundColor: `hsl(${c.cover_hue},60%,10%)` }}
        >
          {c.cover_url && (
            <Image
              src={c.cover_url}
              alt={c.title}
              fill
              sizes="100vw"
              priority={k === 0}
              quality={80}
              className="object-contain object-top"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/45 to-black/5" />
          <div className="absolute bottom-0 left-0 z-10 w-full max-w-[560px] px-14 pb-12 pr-4 md:px-8 md:pb-8">
            <span className="inline-block rounded-[10px] bg-gold px-2 py-0.5 text-[11px] font-extrabold text-black">
              {TYPE_LABEL[c.type]}
            </span>
            <h1 className="mb-1 mt-2 text-[25px] font-bold leading-tight md:text-4xl">
              {c.title}
            </h1>
            <p className="my-1 flex items-center gap-1 text-[12px] text-[#d0d0d0] md:text-[13px]">
              <IconStar className="text-gold" />
              {c.rating_avg.toFixed(1)} · {c.genres.join(" · ")} · Ch{" "}
              {c.latest_chapter_number ?? c.chapter_count}
            </p>
            <p className="my-1 line-clamp-2 text-[12px] text-[#d0d0d0] md:text-[13px]">
              {c.synopsis}
            </p>
            <Link
              href={`/komik/${c.slug}`}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-3xl bg-brand px-5 py-2.5 text-sm font-bold"
            >
              <IconPlay /> Baca Sekarang
            </Link>
          </div>
          {n > 1 && (
            <>
              <button
                type="button"
                aria-label="Sebelumnya"
                onClick={() => go(-1)}
                className="absolute left-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white md:grid"
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                aria-label="Berikutnya"
                onClick={() => go(1)}
                className="absolute right-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white md:grid"
              >
                <IconChevronRight />
              </button>
            </>
          )}
        </div>
      ))}
      {n > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
          {items.map((c, k) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Slide ${k + 1}`}
              aria-current={k === i ? "true" : undefined}
              onClick={() => setI(k)}
              className={`h-2 rounded-full transition-all ${
                k === i ? "w-6 bg-gold" : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
