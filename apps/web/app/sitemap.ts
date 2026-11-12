import type { MetadataRoute } from "next";
import { MODES } from "@/lib/game/modes";
import { LEGAL_DOCS } from "@/lib/legal";
import { SITE_URL } from "@/lib/site";

/** Páginas públicas que queremos en Google. Las privadas están bloqueadas en robots.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" | "yearly") => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "daily"),
    page("/jugar", 0.9, "daily"),
    ...MODES.filter((m) => m.available).map((m) => page(`/jugar/${m.path}`, m.slug === "daily" ? 0.9 : 0.8, "daily")),
    page("/ligas", 0.7, "weekly"),
    page("/registro", 0.5, "monthly"),
    page("/entrar", 0.3, "monthly"),
    ...Object.keys(LEGAL_DOCS).map((slug) => page(`/legal/${slug}`, 0.1, "yearly")),
  ];
}
