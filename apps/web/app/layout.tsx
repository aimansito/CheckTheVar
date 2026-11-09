import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
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
  title: {
    default: "CHECK THE VAR — Quiz de fútbol",
    template: "%s · CHECK THE VAR",
  },
  description:
    "Retos diarios, rachas y ligas con tus amigos. Responde, pulsa CHECK THE VAR y descubre si es gol confirmado.",
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
      <body className="min-h-full flex flex-col bg-bg text-text font-sans">{children}</body>
    </html>
  );
}
