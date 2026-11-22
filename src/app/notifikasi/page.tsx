import type { Metadata } from "next";
import Link from "next/link";
import { markAllRead } from "@/app/admin/actions";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifikasi" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!hasSupabaseEnv()) return <p className="py-16 text-center text-mute">Database belum tersambung.</p>;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-10 max-w-[420px] text-center">
        <h1 className="text-2xl font-bold">Notifikasi</h1>
        <p className="my-3 text-mute">Login dulu untuk melihat notifikasi.</p>
        <Link href="/login?next=/notifikasi" className="inline-block rounded-3xl bg-brand px-7 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const sb = await createClient();
  const { data, error } = await sb.from("notifications").select("id,title,body,link,is_read,created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(50);
  const unread = (data ?? []).some((n) => !n.is_read);
    return (
    <div className="mx-auto max-w-[620px]">
      <div className="my-2 flex items-center justify-between">
        <h1 className="text-[26px] font-bold">Notifikasi</h1>
        {unread && <form action={markAllRead}><button className="rounded-3xl border border-line bg-card px-4 py-2 text-[13px]">Tandai semua dibaca</button></form>}
      </div>
      {error && <p className="text-[#ff6b70]">Gagal memuat: {error.message}</p>}
      {!error && !data?.length && <p className="py-14 text-center text-mute">Belum ada notifikasi.</p>}
      <ul className="space-y-2">
        {(data ?? []).map((n) => {
          const href = n.link ? `/notifikasi/buka/${n.id}` : null;
          const inner = (
            <>
              <div className="flex items-center gap-2">
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Belum dibaca" />}
                <b className="text-[14px]">{n.title}</b>
                <small className="ml-auto shrink-0 text-mute">{timeAgo(n.created_at)}</small>
              </div>
              {n.body && <p className="mt-1 line-clamp-2 break-words text-[13px] text-[#bbb]">{n.body}</p>}
            </>
          );
          return <li key={n.id} className="rounded-2xl border border-line bg-card p-3.5">{href ? <Link href={href} className="block">{inner}</Link> : inner}</li>;
        })}
      </ul>
    </div>
  );
}
