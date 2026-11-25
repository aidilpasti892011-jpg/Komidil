import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/komik", "/jadwal", "/ranking"],
      disallow: [
        "/admin/",
        "/profil/",
        "/login",
        "/register",
        "/notifikasi",
        "/pustaka/",
        "/koleksi/",
        "/komunitas/baru",
      ],
    },
    sitemap: "https://komidil.vercel.app/sitemap.xml",
  };
}
