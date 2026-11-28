import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASE_URL = "https://komidil.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/komik`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/jadwal`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/ranking`, changeFrequency: "daily", priority: 0.7 },
  ];

  if (!hasSupabaseEnv()) return pages;

  try {
    const sb = await createClient();
    const { data } = await sb
      .from("comics")
      .select("slug, updated_at")
      .eq("is_published", true)
      .in("status", ["ongoing", "completed", "hiatus"])
      .order("updated_at", { ascending: false })
      .limit(5000);

    for (const comic of data ?? []) {
      pages.push({
        url: `${BASE_URL}/komik/${comic.slug}`,
        lastModified: comic.updated_at
          ? new Date(comic.updated_at)
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error("Sitemap error:", error);
  }

  return pages;
}
