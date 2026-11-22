import Image from "next/image";
import Link from "next/link";

// Logo asli KOMIDIL (huruf K + tombol play) dari /public/logo.svg
export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-black tracking-[2px]">
      <Image src="/logo.svg" width={34} height={34} alt="" priority />
      KOMIDIL
    </Link>
  );
}
