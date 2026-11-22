"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { actOnTarget, setReportStatus } from "@/app/admin/actions";
import { btnGhost } from "./Ui";
import { timeAgo } from "@/lib/utils";

export type Rep = {
  id: string; target_type: string; target_id: string; reason: string; detail: string | null; status: string; created_at: string;
  reporter: string; preview: string; hidden: boolean | null; link: string | null; exists: boolean;
};
const LABEL: Record<string, string> = { post: "Post", comment: "Komentar", review: "Review", comic: "Komik", chapter_image: "Gambar chapter", user: "User" };
const ST: Record<string, string> = { open: "Baru", reviewing: "Ditinjau", resolved: "Selesai", dismissed: "Ditolak" };

export default function ReportItem({ r, isAdmin }: { r: Rep; isAdmin: boolean }) {
  const [m, setM] = useState("");
  const [pending, start] = useTransition();
  const run = (f: () => Promise<{ error?: string; ok?: string } | undefined>) => start(async () => { const x = await f(); setM(x?.error ?? x?.ok ?? ""); });
  const content = ["post", "comment", "review"].includes(r.target_type) && r.exists;
  const t = r.target_type as "post" | "comment" | "review";
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-md bg-line px-2 py-0.5">{LABEL[r.target_type] ?? r.target_type}</span>
        <span className="rounded-md bg-brand/30 px-2 py-0.5 text-[#ff9a9d]">{r.reason}</span>
        <span className="rounded-md bg-gold px-2 py-0.5 font-bold text-black">{ST[r.status]}</span>
        {r.hidden && <span className="rounded-md bg-line px-2 py-0.5 text-mute">Disembunyikan</span>}
        <span className="text-mute">oleh @{r.reporter} · {timeAgo(r.created_at)}</span>
      </div>
      {r.detail && <p className="mb-2 text-[13px] text-[#ccc]">Keterangan: {r.detail}</p>}
      <div className="rounded-xl bg-bg p-3 text-[13px] text-[#bbb]">
        {r.exists ? <p className="line-clamp-4 whitespace-pre-wrap break-words">{r.preview}</p> : <p className="italic text-mute">Konten sudah dihapus.</p>}
        {r.link && r.exists && <Link href={r.link} className="mt-1.5 inline-block text-gold" target={r.link.startsWith("http") ? "_blank" : undefined}>Buka</Link>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {content && (r.hidden
          ? <button className={btnGhost} disabled={pending} onClick={() => run(() => actOnTarget(t, r.target_id, "show"))}>Tampilkan</button>
          : <button className={btnGhost} disabled={pending} onClick={() => run(() => actOnTarget(t, r.target_id, "hide"))}>Sembunyikan</button>)}
        {content && <button className={`${btnGhost} text-[#ff6b70]`} disabled={pending} onClick={() => confirm("Hapus konten ini permanen?") && run(() => actOnTarget(t, r.target_id, "delete"))}>Hapus konten</button>}
        {r.target_type === "user" && isAdmin && r.link && <Link href={r.link} className={btnGhost}>Atur user</Link>}
        {r.status !== "reviewing" && <button className={btnGhost} disabled={pending} onClick={() => run(() => setReportStatus(r.id, "reviewing"))}>Tinjau</button>}
        {r.status !== "resolved" && <button className={btnGhost} disabled={pending} onClick={() => run(() => setReportStatus(r.id, "resolved"))}>Selesai</button>}
        {r.status !== "dismissed" && <button className={btnGhost} disabled={pending} onClick={() => run(() => setReportStatus(r.id, "dismissed"))}>Tolak</button>}
      </div>
      {m && <p className="mt-2 text-[12px] text-gold">{m}</p>}
    </li>
  );
}
