import Link from "next/link";
import Cover from "./Cover";
import { IconBookmark, IconEye, IconStar } from "./Icons";
import { TYPE_LABEL, type RankedComic } from "@/lib/types";

const nf = new Intl.NumberFormat("id-ID");

export default function RankRow({ c }: { c: RankedComic }) {
  const top = c.rank <= 3;
  return (
    <li>
      <Link
        href={`/komik/${c.slug}`}
        className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-2.5 transition hover:border-brand"
      >
        <span
          className={`w-8 flex-none text-center text-[22px] font-black leading-none ${
            c.rank === 1 ? "text-gold" : top ? "text-white" : "text-mute"
          }`}
          aria-label={`Peringkat ${c.rank}`}
        >
          {c.rank}
        </span>
        <div className="relative aspect-[3/4] w-12 flex-none overflow-hidden rounded-lg">
          <Cover title={c.title} hue={c.cover_hue} url={c.cover_url} sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold">{c.title}</h3>
          <p className="truncate text-[12px] text-mute">
            {TYPE_LABEL[c.type]} · {c.genres.slice(0, 2).join(" · ") || "-"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-mute">
            <span className="inline-flex items-center gap-1"><IconStar className="text-gold" /> {c.rating_avg.toFixed(1)}</span>
            <span className="inline-flex items-center gap-1"><IconEye /> {nf.format(c.views)}</span>
            <span className="inline-flex items-center gap-1"><IconBookmark width={13} height={13} /> {nf.format(c.bookmarks)}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
