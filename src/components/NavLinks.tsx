"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconBookmark, IconCalendar, IconChat, IconHome, IconUser } from "./Icons";

const NAV = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/komik", label: "Komik", Icon: IconBook },
  { href: "/pustaka", label: "Pustaka", Icon: IconBookmark },
  { href: "/komunitas", label: "Komunitas", Icon: IconChat },
  { href: "/profil", label: "Profil", Icon: IconUser },
];

// Menu atas (desktop) punya Jadwal; menu bawah (mobile) tetap 5 item supaya tidak sesak.
const TOP_NAV = [...NAV.slice(0, 2), { href: "/jadwal", label: "Jadwal", Icon: IconCalendar }, ...NAV.slice(2)];

export default function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (variant === "top") {
    return (
      <nav className="hidden gap-1.5 md:flex" aria-label="Menu utama">
        {TOP_NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm transition ${
              active(href) ? "bg-brand text-white" : "text-mute hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-2.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-30 flex justify-around rounded-[22px] border border-line bg-card/95 p-1.5 backdrop-blur md:hidden"
    >
      {NAV.map(({ href, label, Icon }) => {
        const on = active(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] transition ${
              on ? "text-gold" : "text-mute"
            }`}
          >
            <Icon />
            {label}
            {on && (
              <span className="absolute bottom-0 h-[3px] w-5 rounded bg-gradient-to-r from-brand to-gold" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
