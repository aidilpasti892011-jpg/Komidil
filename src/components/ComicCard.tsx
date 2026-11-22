import Link from "next/link";
import Cover from "./Cover";
import { IconStar } from "./Icons";
import { TYPE_LABEL, type ComicCardData } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function ComicCard({ c }: { c: ComicCardData }) {
  const href = `/komik/${c.slug}`;
  return (
    <Link href={href} className="block overflow-hidden rounded-[14px] bg-card transition hover:-translate-y-1">
      <div className="relative aspect-[3/4]">
        <Cover title={c.title} hue={c.cover_hue} url={c.cover_url} />
        <span className="absolute left-2 top-2 rounded-[10px] bg-gold px-2 py-0.5 text-[11px] font-extrabold text-black">
          {TYPE_LABEL[c.type]}
        </span>
      </div>
      <h3 className="truncate px-2.5 pt-2 text-sm font-semibold">{c.title}</h3>
      <p className="flex items-center gap-1 px-2.5 text-xs text-mute">
        <IconStar className="text-gold" /> {c.rating_avg.toFixed(1)} · Ch {c.latest_chapter_number ?? c.chapter_count} ·{" "}
        {c.status}
      </p>
      <small className="block px-2.5 text-xs text-mute">{c.genres.slice(0, 2).join(" · ")}</small>
      <small className="block px-2.5 pb-2.5 text-xs text-mute">{timeAgo(c.last_chapter_at)}</small>
    </Link>
  );
}
