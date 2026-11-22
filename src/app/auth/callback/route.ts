import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validators";

// Tujuan link email (konfirmasi / reset password) dan balikan login Google.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/login?e=google`);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?e=link`);
}
