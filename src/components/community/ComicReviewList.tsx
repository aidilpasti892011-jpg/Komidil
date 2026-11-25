import type { ComicReview } from "@/lib/comics";

export default function ComicReviewList({ reviews }: { reviews: ComicReview[] }) {
  if (!reviews.length) {
    return <p className="mt-3 text-sm text-mute">Belum ada ulasan tertulis untuk komik ini.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {review.profiles?.display_name || review.profiles?.username || "Pengguna"}
              </p>
              {review.profiles?.display_name && review.profiles?.username && (
                <p className="text-xs text-mute">@{review.profiles.username}</p>
              )}
            </div>
            <span className="shrink-0 text-sm text-gold">
              {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
            </span>
          </div>

          {review.has_spoiler && (
            <p className="mt-2 text-xs font-semibold text-gold">Mengandung spoiler</p>
          )}

          {review.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#d0d0d0]">{review.body}</p>
          )}

          <p className="mt-3 text-xs text-mute">
            {new Date(review.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </article>
      ))}
    </div>
  );
}
