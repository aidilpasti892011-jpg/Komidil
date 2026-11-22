import Link from "next/link";
import ComicCard from "./ComicCard";
import { getRecommendations } from "@/lib/personal";

// Baris "Untukmu" di Home. Tidak tampil kalau belum login, belum ada riwayat, atau 0010 belum dijalankan.
export default async function ForYou() {
  const { data } = await getRecommendations(10);
  if (data.length === 0) return null;
  return (
    <section aria-label="Untukmu" className="mb-1.5">
      <div className="mb-2.5 mt-5 flex items-center justify-between">
        <h2 className="text-[19px] font-bold">Untukmu</h2>
        <Link href="/untukmu" className="text-[13px] text-gold">Lihat Semua</Link>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1.5">
        {data.map(({ comic, reason }) => (
          <div key={comic.id} className="w-[140px] flex-none md:w-[170px]">
            <ComicCard c={comic} />
            <p className="mt-1.5 truncate px-1 text-[11px] text-gold">{reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
