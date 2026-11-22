// Konstanta + validasi komunitas. Dipakai server action dan UI (bukan "use server").
export const CAT_TABS = [
  { key: "semua", label: "Semua" },
  { key: "pengumuman", label: "Pengumuman" },
  { key: "info_komik", label: "Info Komik" },
  { key: "diskusi", label: "Ruang Diskusi" },
  { key: "spoiler", label: "Spoiler" },
  { key: "polling", label: "Polling" },
  { key: "review", label: "Review" },
] as const;

export type PostCat = "pengumuman" | "info_komik" | "diskusi" | "spoiler" | "polling";
export const POST_CATS: { key: PostCat; label: string }[] = [
  { key: "diskusi", label: "Ruang Diskusi" },
  { key: "info_komik", label: "Info Komik" },
  { key: "spoiler", label: "Spoiler" },
  { key: "polling", label: "Polling" },
  { key: "pengumuman", label: "Pengumuman" }, // hanya staff (dicek server + RLS)
];
export const CAT_LABEL: Record<string, string> = Object.fromEntries(CAT_TABS.map((t) => [t.key, t.label]));

export const REPORT_REASONS = ["Spam", "Konten tidak pantas", "Spoiler tanpa peringatan", "Pelecehan atau ujaran kebencian", "Lainnya"] as const;
export const REPORT_TARGETS = ["post", "comment", "review"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rapikan teks: buang karakter kontrol, batasi baris kosong berturut-turut. */
export function clean(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export type Author = { username: string; display_name: string | null; avatar_url: string | null; role: "user" | "moderator" | "admin"; rank_level?: number | null };
export type PostRow = {
  id: string; category: string; title: string; body: string; has_spoiler: boolean;
  is_pinned: boolean; is_locked: boolean; is_hidden: boolean; like_count: number; comment_count: number;
  created_at: string; user_id: string; profiles: Author | null; comics: { title: string; slug: string } | null;
};
export type CommentRow = {
  id: string; post_id: string; user_id: string; parent_id: string | null; body: string;
  is_hidden: boolean; like_count: number; created_at: string; profiles: Author | null;
};
export type ReviewRow = {
  id: string; rating: number; body: string | null; has_spoiler: boolean; is_hidden: boolean; like_count: number;
  created_at: string; user_id: string; profiles: Author | null; comics: { title: string; slug: string } | null;
};
export const POST_SELECT =
  "id,category,title,body,has_spoiler,is_pinned,is_locked,is_hidden,like_count,comment_count,created_at,user_id,profiles(username,display_name,avatar_url,role,rank_level),comics(title,slug)";
export const REVIEW_SELECT =
  "id,rating,body,has_spoiler,is_hidden,like_count,created_at,user_id,profiles(username,display_name,avatar_url,role,rank_level),comics(title,slug)";
