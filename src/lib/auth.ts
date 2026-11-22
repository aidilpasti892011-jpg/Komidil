import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: "user" | "moderator" | "admin";
  xp: number;
  rank_level: number;
  created_at: string;
};

export async function getCurrentUser(): Promise<{ id: string; email: string | null; profile: Profile | null } | null> {
  if (!hasSupabaseEnv()) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb
    .from("profiles")
    .select("id,username,display_name,avatar_url,bio,role,xp,rank_level,created_at")
    .eq("id", data.user.id)
    .maybeSingle();
  return { id: data.user.id, email: data.user.email ?? null, profile: (p as Profile | null) ?? null };
}
