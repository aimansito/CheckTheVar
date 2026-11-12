import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CHECK THE VAR — Quiz de fútbol diario",
    template: "%s · CHECK THE VAR",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    url: "./",
    title: "CHECK THE VAR — ¿Sabes de fútbol? Que lo diga el VAR.",
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // Verificación de Google Search Console por etiqueta HTML (opcional si se verifica por DNS).
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0A0D0B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: algunas extensiones del navegador (p. ej. UI.Vision/Kantu) añaden
    // atributos a <html> antes de hidratar. Solo afecta a los atributos de esta etiqueta.
    <html
      lang="es"
      className={`${anton.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans">
        {children}
        {/* Suspense: el aviso lee la ruta actual (usePathname), que solo existe en el navegador. */}
        <Suspense fallback={null}>
          <CookieConsent />
        </Suspense>
        {/* Vercel Web Analytics: sin cookies ni datos personales, no necesita consentimiento. */}
        <Analytics />
      </body>
    </html>
  );
}
