/** Blok skeleton (hanya dekorasi). Bungkus dengan <SkeletonPage> supaya terbaca sebagai status memuat. */
export function Sk({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[14px] bg-card ${className}`} />;
}

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Memuat halaman">
      <span className="sr-only">Memuat</span>
      {children}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[14px] bg-card">
      <div className="aspect-[3/4] animate-pulse bg-line/60" />
      <div className="space-y-1.5 p-2.5">
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-line/60" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-line/60" />
      </div>
    </div>
  );
}

export function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: n }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
