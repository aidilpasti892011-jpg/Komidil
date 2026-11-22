/** Logo KOMIDIL (huruf K + tombol play) dengan animasi ringan. Bentuknya sama dengan public/logo.svg. */
export default function KLoader({ size = 64, label = "Memuat" }: { size?: number; label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <svg className="k-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#D71920" />
        <path className="k-path" d="M9 7h4v7l7-7h5l-8 9 8 9h-5l-7-7v7H9z" fill="#fff" />
        <path className="k-play" d="M20 13.5v5l5-2.5z" fill="#FFC629" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
