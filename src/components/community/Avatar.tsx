import type { Author } from "@/lib/community";

export default function Avatar({ a, size = 32 }: { a: Author | null; size?: number }) {
  const name = a?.display_name || a?.username || "?";
  if (a?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.avatar_url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid place-items-center rounded-full bg-line font-bold text-gold" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function RoleBadge({ role }: { role?: string }) {
  if (role === "admin") return <span className="rounded-md bg-brand px-1.5 py-px text-[10px] font-bold">Super Admin</span>;
  if (role === "moderator") return <span className="rounded-md bg-gold px-1.5 py-px text-[10px] font-bold text-black">Moderator</span>;
  return null;
}
