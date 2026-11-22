import KLoader from "./KLoader";

/**
 * Splash singkat (sekitar 1 detik) saat halaman dibuka penuh (buka aplikasi / refresh).
 * Murni CSS: tidak ada JavaScript, tidak mengganggu hydration, dan tidak muncul lagi saat pindah halaman.
 */
export default function Splash() {
  return (
    <div className="splash fixed inset-0 z-[100] grid place-items-center bg-bg" aria-hidden="true">
      <KLoader size={84} label="" />
    </div>
  );
}
