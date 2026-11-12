import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinLeagueForm } from "@/components/leagues/LeagueForms";
import { currentUserId, inviteInfo } from "@/lib/leagues";

export const metadata: Metadata = { title: "Invitación a una liga" };

export default function InvitePage({ params }: PageProps<"/ligas/unirse/[codigo]">) {
  return (
    <AuthShell
      title="Te han"
      accent="invitado"
      subtitle="Únete a la liga y compite cada semana."
      footer={
        <Link href="/ligas" className="font-semibold text-text underline">
          Ir a mis ligas
        </Link>
      }
    >
      <Suspense fallback={<p className="text-muted">Buscando la liga…</p>}>
        <Invite params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function Invite({ params }: { params: PageProps<"/ligas/unirse/[codigo]">["params"] }) {
  const code = (await params).codigo.toUpperCase();
  const valid = /^[A-HJKMNP-Z2-9]{6}$/.test(code);
  const [league, userId] = await Promise.all([valid ? inviteInfo(code) : null, currentUserId()]);

  if (!league) {
    return <p className="text-muted">Ese código no corresponde a ninguna liga. Pide a quien te invitó que te lo vuelva a pasar.</p>;
  }

  const next = `/ligas/unirse/${code}`;
  return (
    <div>
      <p className="font-display text-3xl uppercase">{league.name}</p>
      <p className="mt-1 text-sm text-muted">
        {league.members}/{league.maxMembers} jugadores
      </p>
      <div className="mt-5">
        {userId ? (
          <JoinLeagueForm defaultCode={code} />
        ) : (
          <>
            <p className="text-sm text-muted">Necesitas una cuenta gratis para jugar ligas. Al terminar vuelves aquí.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/registro?next=${encodeURIComponent(next)}`} className="rounded-xl bg-var px-6 py-3.5 font-bold text-bg">
                Crear cuenta
              </Link>
              <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="rounded-xl border border-line bg-surface px-6 py-3.5 font-bold">
                Iniciar sesión
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
