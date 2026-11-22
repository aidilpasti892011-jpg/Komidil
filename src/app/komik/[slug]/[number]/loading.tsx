import KLoader from "@/components/KLoader";

// Reader tampil layar penuh, jadi loader-nya juga layar penuh.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black">
      <KLoader size={72} label="Memuat chapter" />
    </div>
  );
}
