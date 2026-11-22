export type ComicType = "manhwa" | "manhua" | "manga" | "webtoon";
export type ComicStatus = "ongoing" | "completed" | "hiatus";
export type SortKey = "up" | "pop" | "r" | "az" | "new" | "fol" | "rel";

export const COMIC_TYPES: ComicType[] = ["manhwa", "manhua", "manga", "webtoon"];
export const COMIC_STATUSES: ComicStatus[] = ["ongoing", "completed", "hiatus"];
export const SORT_KEYS: SortKey[] = ["up", "pop", "r", "az", "new", "fol", "rel"];

export const TYPE_LABEL: Record<ComicType, string> = {
  manhwa: "Manhwa",
  manhua: "Manhua",
  manga: "Manga",
  webtoon: "Webtoon",
};
export const STATUS_LABEL: Record<ComicStatus, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
};
export const SORT_LABEL: Record<SortKey, string> = {
  up: "Update terbaru",
  pop: "Terpopuler",
  r: "Rating tertinggi",
  az: "A-Z",
  new: "Baru ditambahkan",
  fol: "Paling banyak diikuti",
  rel: "Paling relevan",
};

export type Genre = { id: number; name: string; slug: string };

export type ComicCardData = {
  id: string;
  slug: string;
  title: string;
  type: ComicType;
  status: ComicStatus;
  synopsis: string | null;
  cover_url: string | null;
  cover_hue: number;
  rating_avg: number;
  chapter_count: number;
  latest_chapter_number: number | null;
  last_chapter_at: string | null;
  genres: string[];
};

// Ranking (langkah 8). Ada di sini supaya aman diimpor Client Component.
export type Period = "daily" | "weekly" | "monthly";
export const PERIODS: Period[] = ["daily", "weekly", "monthly"];
export const PERIOD_LABEL: Record<Period, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
export type RankedComic = ComicCardData & { rank: number; score: number; views: number; bookmarks: number };

// Pencarian lanjutan (tahap 10)
export const RATING_MIN_OPTIONS = [0, 3, 4, 4.5] as const;
export const MAX_GENRE_FILTER = 5;
