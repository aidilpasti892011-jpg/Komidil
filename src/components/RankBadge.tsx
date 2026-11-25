import { rankByLevel } from "@/lib/ranks";

const RANK_LOGOS = [
  "01-culun.png",
  "02-pemula.png",
  "03-pendatang.png",
  "04-aktif.png",
  "05-terkenal.png",
  "06-veteran.png",
  "07-elite.png",
  "08-legenda.png",
  "09-hunter.png",
  "10-sepuh.png",
];

export default function RankBadge({
  level,
  role,
  className = "",
}: {
  level?: number | null;
  role?: string | null;
  className?: string;
}) {
  const r = rankByLevel(role === "admin" ? 9 : level);

  return (
    <span
      title={`${r.name} (Level ${r.level + 1})`}
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
    >
      <img
        src={`/images/ranks/${RANK_LOGOS[r.level]}`}
        alt={`Rank ${r.name}`}
        width={24}
        height={24}
        className="h-6 w-6 object-contain"
      />
      <span className={`rounded-md px-1.5 py-px text-[10px] font-bold ${r.tone}`}>
        {r.name}
      </span>
    </span>
  );
}
