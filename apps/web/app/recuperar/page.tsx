import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetRequestForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function ResetPage() {
  return (
    <AuthShell
      title="¿Sin"
      accent="contraseña?"
      subtitle="Te enviamos un enlace para crear una nueva."
      footer={
        <>
          <Link href="/entrar" className="font-semibold text-text underline">
            Volver a iniciar sesión
          </Link>
        </>
      }
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
