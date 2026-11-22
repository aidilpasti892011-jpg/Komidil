import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import NavLinks from "@/components/NavLinks";
import Splash from "@/components/Splash";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KOMIDIL - Your World of Comics", template: "%s | KOMIDIL" },
  description: "KOMIDIL: baca manhwa, manhua, dan manga. Your World of Comics.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(64px+env(safe-area-inset-top))] md:pb-6">
        <Splash />
        <Header />
        <main className="mx-auto max-w-[1100px] px-3.5">{children}</main>
        <NavLinks variant="bottom" />
      </body>
    </html>
  );
}
