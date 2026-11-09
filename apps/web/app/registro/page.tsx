import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Ficha por"
      accent="CHECK THE VAR"
      subtitle="Gratis. Guarda tus puntos, mantén la racha y compite en ligas con tus amigos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-semibold text-text underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
