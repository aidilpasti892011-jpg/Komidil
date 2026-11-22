import Link from "next/link";
import Cover from "./Cover";
import { IconBell } from "./Icons";
import { chapterLabel, releaseTime, timeUntil, type ScheduleItem } from "@/lib/schedule";
import { TYPE_LABEL } from "@/lib/types";

export default function ScheduleRow({ item }: { item: ScheduleItem }) {
  return (
    <Link
      href={`/komik/${item.slug}`}
      className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-2.5 transition hover:border-brand"
    >
      <div className="relative aspect-[3/4] w-[52px] flex-none overflow-hidden rounded-lg">
        <Cover title={item.title} hue={item.cover_hue} url={item.cover_url} sizes="52px" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold">
          <span className="truncate">{item.title}</span>
          {item.followed && (
            <IconBell width={14} height={14} className="flex-none text-gold" aria-hidden={false} aria-label="Kamu ikuti komik ini" role="img" />
          )}
        </h3>
        <p className="mt-0.5 truncate text-[13px] text-mute">
          {TYPE_LABEL[item.type]} · {chapterLabel(item)}
        </p>
      </div>
      <div className="flex-none text-right">
        <p className="text-[13px] font-bold tabular-nums">{releaseTime(item.releaseAt)}</p>
        {item.released ? (
          <span className="mt-1 inline-block rounded-full border border-gold/50 px-2 py-0.5 text-[11px] font-bold text-gold">
            Sudah rilis
          </span>
        ) : (
          <span className="mt-1 inline-block text-[11px] text-mute">{timeUntil(item.releaseAt)}</span>
        )}
      </div>
    </Link>
  );
}
