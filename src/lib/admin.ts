import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/utils";

export { UUID_RE, IMG_TYPES, slugify } from "@/lib/shared";

/** Dipakai di halaman admin. Tidak login -> login; bukan staff -> 404. */
export async function requireStaff(next = "/admin") {
  if (!hasSupabaseEnv()) notFound();
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  const role = me.profile?.role;
  if (role !== "admin" && role !== "moderator") notFound();
  return { ...me, role };
}
export async function requireAdmin(next = "/admin") {
  const me = await requireStaff(next);
  if (me.role !== "admin") notFound();
  return me;
}
