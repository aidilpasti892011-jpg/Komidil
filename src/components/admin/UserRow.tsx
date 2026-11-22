"use client";
import { useState, useTransition } from "react";
import { setRole, suspendUser, unsuspendUser } from "@/app/admin/actions";
import { btnGhost, btnRed, field } from "./Ui";
import { timeAgo } from "@/lib/utils";

export type U = {
  id: string; username: string; display_name: string | null; role: "user" | "moderator" | "admin";
  is_suspended: boolean; suspended_until: string | null; suspended_reason: string | null; xp: number; created_at: string;
};

export default function UserRow({ u, isSelf }: { u: U; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [m, setM] = useState("");
  const [pending, start] = useTransition();
  const active = u.is_suspended && (!u.suspended_until || new Date(u.suspended_until) > new Date());
  const run = (f: () => Promise<{ error?: string; ok?: string } | undefined>) => start(async () => { const r = await f(); setM(r?.error ?? r?.ok ?? ""); if (r?.ok) setOpen(false); });
  const locked = isSelf || u.role === "admin";

  return (
    <li className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block truncate">{u.display_name || u.username}</b>
          <small className="text-mute">@{u.username} · {u.xp} XP · gabung {timeAgo(u.created_at)}</small>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${u.role === "admin" ? "bg-brand" : u.role === "moderator" ? "bg-gold text-black" : "bg-line text-[#ccc]"}`}>
            {u.role === "admin" ? "Super Admin" : u.role === "moderator" ? "Moderator" : "User"}
          </span>
          {active && <span className="rounded-md bg-brand/30 px-2 py-0.5 text-[11px] text-[#ff9a9d]">Disuspend</span>}
        </div>
      </div>
      {active && (
        <p className="mt-1.5 text-[12px] text-mute">
          {u.suspended_reason} · {u.suspended_until ? `sampai ${new Date(u.suspended_until).toLocaleDateString("id-ID")}` : "tanpa batas waktu"}
        </p>
      )}
      {!locked && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button className={btnGhost} disabled={pending} onClick={() => run(() => setRole(u.id, u.role === "moderator" ? "user" : "moderator"))}>
            {u.role === "moderator" ? "Cabut moderator" : "Jadikan moderator"}
          </button>
          {active ? (
            <button className={btnGhost} disabled={pending} onClick={() => run(() => unsuspendUser(u.id))}>Cabut suspend</button>
          ) : (
            <button className={`${btnGhost} text-[#ff6b70]`} onClick={() => setOpen(!open)}>Suspend</button>
          )}
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Alasan suspend" className={`${field} !mt-0`} />
          <select value={days} onChange={(e) => setDays(e.target.value)} className={`${field} !mt-0`}>
            <option value="1">1 hari</option><option value="7">7 hari</option><option value="30">30 hari</option><option value="365">1 tahun</option><option value="perm">Tanpa batas waktu</option>
          </select>
          <button className={btnRed} disabled={pending} onClick={() => run(() => suspendUser(u.id, reason, days === "perm" ? null : Number(days)))}>Konfirmasi suspend</button>
        </div>
      )}
      {m && <p className="mt-2 text-[12px] text-gold">{m}</p>}
    </li>
  );
}
