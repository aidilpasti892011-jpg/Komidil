import { rankByLevel } from "@/lib/ranks";

/** Badge rank pembaca. level berasal dari kolom profiles.rank_level (dihitung database). */
export default function RankBadge({ level, className = "" }: { level?: number | null; className?: string }) {
  const r = rankByLevel(level);
  return (
    <span
      title={`${r.name} (level ${r.level + 1})`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-[10px] font-bold ${r.tone} ${className}`}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
      </svg>
      {r.name}
    </span>
  );
}
