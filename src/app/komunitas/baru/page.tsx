import type { Metadata } from "next";
import Link from "next/link";
import PostForm from "@/components/community/PostForm";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Buat post" };

export default async function Page({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  if (!hasSupabaseEnv()) return <p className="py-16 text-center text-mute">Database belum tersambung.</p>;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-10 max-w-[420px] text-center">
        <h1 className="text-2xl font-bold">Buat post</h1>
        <p className="my-3 text-mute">Login dulu untuk membuat post.</p>
        <Link href="/login?next=/komunitas/baru" className="inline-block rounded-3xl bg-brand px-7 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const sb = await createClient();
  const { data } = await sb.from("comics").select("id,title").eq("is_published", true).order("title").limit(300);
  const sp = await searchParams;
  const admin = me.profile?.role === "admin";
  return (
    <div className="mx-auto my-4 max-w-[560px]">
      <Link href="/komunitas" className="text-[13px] text-mute">Kembali</Link>
      <h1 className="mb-4 mt-2 text-[26px] font-bold">Buat post</h1>
      <PostForm comics={data ?? []} admin={admin} initialCat={sp.cat ?? "diskusi"} />
    </div>
  );
}
