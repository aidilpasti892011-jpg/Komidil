import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tandai satu notifikasi sebagai dibaca lalu arahkan ke tautannya.
// Tautan hanya boleh path internal (diawali "/" dan bukan "//") agar tidak jadi open redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!UUID.test(id)) return back("/notifikasi");

  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return back(`/login?next=${encodeURIComponent("/notifikasi")}`);

  const { data } = await sb
    .from("notifications")
    .select("link")
    .eq("id", id)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!data) return back("/notifikasi");

  await sb.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", u.user.id);
  const l = data.link as string | null;
  return back(l && l.startsWith("/") && !l.startsWith("//") ? l : "/notifikasi");
}
