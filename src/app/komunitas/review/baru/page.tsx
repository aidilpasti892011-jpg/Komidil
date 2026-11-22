import type { Metadata } from "next";
import Link from "next/link";
import ReviewForm from "@/components/community/ReviewForm";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export const metadata: Metadata = { title: "Tulis review" };

export default async function Page() {
  if (!hasSupabaseEnv()) return <p className="py-16 text-center text-mute">Database belum tersambung.</p>;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="mx-auto my-10 max-w-[420px] text-center">
        <h1 className="text-2xl font-bold">Tulis review</h1>
        <p className="my-3 text-mute">Login dulu untuk menulis review.</p>
        <Link href="/login?next=/komunitas/review/baru" className="inline-block rounded-3xl bg-brand px-7 py-2.5 text-sm font-bold">Masuk</Link>
      </div>
    );
  }
  const sb = await createClient();
  const { data } = await sb.from("comics").select("id,title").eq("is_published", true).order("title").limit(300);
  return (
    <div className="mx-auto my-4 max-w-[560px]">
      <Link href="/komunitas?cat=review" className="text-[13px] text-mute">Kembali</Link>
      <h1 className="mb-4 mt-2 text-[26px] font-bold">Tulis review</h1>
      <ReviewForm comics={data ?? []} />
    </div>
  );
}
