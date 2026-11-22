import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { safeNext } from "@/lib/validators";

export const metadata: Metadata = { title: "Masuk" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.e === "link" && <p className="mt-3 text-center text-sm text-[#ff6b70]">Link tidak valid atau sudah kedaluwarsa. Coba lagi.</p>}
      {sp.e === "google" && <p className="mt-3 text-center text-sm text-[#ff6b70]">Login Google gagal. Coba lagi.</p>}
      <AuthForm mode="login" next={safeNext(sp.next)} />
    </>
  );
}
