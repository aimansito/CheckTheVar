import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthShell
      title="Vuelve al"
      accent="vestuario"
      subtitle="Inicia sesión para seguir con tu racha."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-text underline">
            Regístrate gratis
          </Link>
        </>
      }
    >
      <Suspense fallback={<SignInForm />}>
        <SignInWithParams searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignInWithParams({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { error } = await searchParams;
  return <SignInForm linkError={error === "enlace"} />;
}
