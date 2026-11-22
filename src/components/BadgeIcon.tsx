// Ikon badge prestasi (SVG). Kunci ikon datang dari tabel achievements.icon.
const TONE: Record<number, string> = {
  1: "bg-[#2e2e2e] text-white",
  2: "bg-[#2a2209] text-gold",
  3: "bg-gold text-black",
  4: "bg-brand text-white",
};

const PATHS: Record<string, React.ReactNode> = {
  book: <><path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" /><path d="M5 16a4 4 0 0 1 4-4h9" /></>,
  books: <><path d="M5 4v16M10 4v16" /><path d="m14.5 6.5 4 13.5M14.5 6.5 18 5.5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  flag: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  bookmark: <path d="M7 4h10v16l-5-4-5 4z" />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  layers: <><path d="m12 4 9 5-9 5-9-5z" /><path d="m3 14 9 5 9-5" /></>,
  pen: <><path d="m4 20 1-4 11-11 3 3L8 19z" /><path d="m14 7 3 3" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
};

export default function BadgeIcon({
  icon,
  tier,
  unlocked,
  size = 52,
}: {
  icon: string;
  tier: number;
  unlocked: boolean;
  size?: number;
}) {
  const tone = unlocked ? (TONE[tier] ?? TONE[1]) : "border border-line bg-card text-[#4a4a4a]";
  return (
    <span
      className={`grid flex-none place-items-center rounded-2xl ${tone}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[icon] ?? PATHS.star}
      </svg>
    </span>
  );
}
