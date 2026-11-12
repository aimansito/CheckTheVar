import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/AuthForms";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default function SecurityPage() {
  return (
    <AuthShell
      title="Cambiar"
      accent="contraseña"
      subtitle="Elige una contraseña nueva. Cerrará las demás sesiones abiertas."
      footer={
        <Link href="/perfil" className="font-semibold text-text underline">
          Volver a mi perfil
        </Link>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <Guarded />
      </Suspense>
    </AuthShell>
  );
}

async function Guarded() {
  if (!(await getCurrentProfile())) redirect("/entrar");
  return <NewPasswordForm />;
}
