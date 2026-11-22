import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const items = [
    ["/admin", "Statistik", true],
    ["/admin/komik", "Komik", me.role === "admin"],
    ["/admin/user", "User", me.role === "admin"],
    ["/admin/laporan", "Moderasi", me.role === "admin"],
  ] as const;
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-1 mt-1 flex items-center justify-between">
        <h1 className="text-[26px] font-bold">Dashboard</h1>
        <span className="rounded-[10px] bg-gold px-2.5 py-0.5 text-[11px] font-extrabold text-black">{me.role === "admin" ? "Super Admin" : "Moderator"}</span>
      </div>
      <nav className="no-scrollbar -mx-3.5 mb-4 flex gap-2 overflow-x-auto px-3.5" aria-label="Menu admin">
        {items.filter((i) => i[2]).map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-line bg-card px-4 py-2 text-sm text-[#ddd]">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
