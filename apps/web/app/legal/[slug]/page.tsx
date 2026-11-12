import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LEGAL_DOCS, LEGAL_UPDATED, type LegalDoc } from "@/lib/legal";

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: LEGAL_DOCS[slug]?.title ?? "Legal" };
}

export default function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:py-16">
        <Suspense fallback={<div className="h-96" aria-hidden />}>
          <LegalContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function LegalContent({ params }: { params: PageProps<"/legal/[slug]">["params"] }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) notFound();
  return <LegalArticle doc={doc} current={slug} />;
}

function LegalArticle({ doc, current }: { doc: LegalDoc; current: string }) {
  return (
    <article>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Documentos legales">
        {Object.entries(LEGAL_DOCS).map(([slug, d]) => (
          <Link
            key={slug}
            href={`/legal/${slug}`}
            aria-current={slug === current ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition ${
              slug === current ? "border-var text-text" : "border-line text-muted hover:text-text"
            }`}
          >
            {d.title}
          </Link>
        ))}
      </nav>
      <h1 className="mt-8 text-4xl font-bold tracking-tight text-balance sm:text-5xl">{doc.title}</h1>
      <p className="mt-3 text-xs text-muted">Última actualización: {LEGAL_UPDATED}</p>
      <p className="mt-6 text-lg leading-relaxed text-muted text-pretty">{doc.intro}</p>

      <div className="mt-10 space-y-10">
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold">{s.title}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-muted">
              {s.body.map((b, i) =>
                Array.isArray(b) ? (
                  <ul key={i} className="list-disc space-y-2 pl-5 marker:text-var">
                    {b.map((li) => (
                      <li key={li} className="text-pretty">
                        {li}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="text-pretty">
                    {b}
                  </p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
