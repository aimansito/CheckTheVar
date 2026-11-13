import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Zonas privadas o sin contenido útil para buscadores.
      disallow: ["/api/", "/auth/", "/bienvenida", "/perfil", "/nueva-contrasena", "/recuperar", "/ligas/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
