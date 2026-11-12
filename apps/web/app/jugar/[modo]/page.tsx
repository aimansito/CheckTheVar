import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Corners } from "@/components/brand/Logo";
import { Game } from "@/components/game/Game";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCurrentProfile } from "@/lib/auth";
import { MODES, modeByPath, type ModeInfo } from "@/lib/game/modes";

export function generateStaticParams() {
  return MODES.filter((m) => m.available).map((m) => ({ modo: m.path }));
}

export async function generateMetadata({ params }: PageProps<"/jugar/[modo]">): Promise<Metadata> {
  const info = modeByPath((await params).modo);
  return info ? { title: info.name, description: info.tagline } : {};
}

export default function ModePage({ params }: PageProps<"/jugar/[modo]">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<p className="py-16 text-center text-muted">Comprobando tu ficha…</p>}>
          <ModeContent params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function ModeContent({ params }: { params: PageProps<"/jugar/[modo]">["params"] }) {
  const info = modeByPath((await params).modo);
  if (!info || !info.available) notFound();
  const profile = await getCurrentProfile();
  if (info.free || profile) return <Game mode={info.slug} defaultDifficulty={profile?.difficulty} />;
  return <AccountGate info={info} />;
}

/** Modos con cuenta: si no hay sesión, invita a registrarse en vez de dar un 401. */
function AccountGate({ info }: { info: ModeInfo }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="scanlines relative overflow-hidden rounded-2xl border border-line bg-screen p-6 text-center">
        <Corners />
        <p className="relative text-xs font-bold uppercase tracking-wider text-var">{info.name}</p>
        <h1 className="relative mt-2 font-display text-4xl uppercase">Solo con cuenta</h1>
        <p className="relative mt-3 text-sm text-muted">{info.howTo}</p>
        <p className="relative mt-3 text-sm text-muted">Crea una cuenta gratis para jugar todos los modos, guardar tus marcas y competir en ligas.</p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg">
            Crear cuenta gratis
          </Link>
          <Link href="/entrar" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Sin cuenta puedes jugar el{" "}
        <Link href="/jugar/diario" className="font-semibold text-text underline">
          reto diario
        </Link>
        .
      </p>
    </div>
  );
}
