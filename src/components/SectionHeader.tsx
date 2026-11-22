import Link from "next/link";

export default function SectionHeader({ title, href = "/komik" }: { title: string; href?: string }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center justify-between">
      <h2 className="text-[19px] font-bold">{title}</h2>
      <Link href={href} className="text-[13px] text-gold">
        Lihat Semua
      </Link>
    </div>
  );
}
