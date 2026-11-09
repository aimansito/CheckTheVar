import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

const DOCS: Record<string, string> = {
  aviso: "Aviso legal",
  privacidad: "Política de privacidad",
  cookies: "Política de cookies",
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: DOCS[slug] ?? "Legal" };
}

/**
 * PROVISIONAL: estos textos los debe redactar/revisar una persona responsable antes de abrir
 * la web al público (RGPD). Aquí solo se indica qué datos se usan hoy.
 */
export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const title = DOCS[slug];
  if (!title) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="font-display text-5xl uppercase">{title}</h1>
        <p className="mt-6 rounded-xl border border-dashed border-line p-4 text-muted">
          Documento en preparación. Mientras tanto, esto es lo que hace CHECK THE VAR con tus datos:
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-6 text-muted">
          <li>
            <strong className="text-text">Cookie técnica de invitado</strong> (<code>ctv_guest</code>): un
            identificador aleatorio para que puedas jugar el reto diario sin cuenta y guardar tus puntos al
            registrarte. Es necesaria para el juego y no se usa para publicidad.
          </li>
          <li>
            <strong className="text-text">Cookies de sesión</strong> de Supabase si inicias sesión.
          </li>
          <li>
            <strong className="text-text">Datos de cuenta</strong>: nombre de jugador, email y tus resultados,
            alojados en la Unión Europea.
          </li>
          <li>No usamos todavía analítica ni publicidad.</li>
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
