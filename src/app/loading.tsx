import KLoader from "@/components/KLoader";

// Cadangan untuk halaman tanpa skeleton sendiri (profil, login, pustaka, dst).
export default function Loading() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <KLoader />
    </div>
  );
}
