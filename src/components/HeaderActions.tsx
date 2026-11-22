import Link from "next/link";
import { IconBell, IconShield } from "./Icons";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

// Lonceng notifikasi + pintasan dashboard (hanya staff). Tidak tampil kalau belum login.
export default async function HeaderActions() {
  if (!hasSupabaseEnv()) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const [{ count }, { data: p }] = await Promise.all([
    sb.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", data.user.id).eq("is_read", false),
    sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle(),
  ]);
  const staff = p?.role === "admin" || p?.role === "moderator";
  const n = count ?? 0;
  return (
    <div className="flex items-center gap-1">
      {staff && <Link href="/admin" aria-label="Dashboard admin" className="grid h-10 w-10 place-items-center rounded-full text-mute hover:text-white"><IconShield /></Link>}
      <Link href="/notifikasi" aria-label={n ? `Notifikasi, ${n} belum dibaca` : "Notifikasi"} className="relative grid h-10 w-10 place-items-center rounded-full text-mute hover:text-white">
        <IconBell />
        {n > 0 && <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">{n > 9 ? "9+" : n}</span>}
      </Link>
    </div>
  );
}
