"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/lib/auth-actions";

const input =
  "mt-1.5 block w-full rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none transition focus:border-var";

function Field({
  label,
  name,
  type = "text",
  error,
  defaultValue,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={`${input} ${error ? "border-ko" : ""}`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-ko">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
      )}
    </label>
  );
}

function Alerts({ state }: { state: AuthState }) {
  return (
    <>
      {state.error && <p className="rounded-xl border border-ko bg-ko-bg px-4 py-3 text-sm">{state.error}</p>}
      {state.info && <p className="rounded-xl border border-var bg-ok-bg px-4 py-3 text-sm">{state.info}</p>}
    </>
  );
}

const submit =
  "w-full rounded-xl bg-var py-3.5 font-bold text-bg transition hover:brightness-110 disabled:opacity-60";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      <Field label="Nombre de jugador" name="username" error={fe.username} defaultValue={state.values?.username} autoComplete="username" hint="Así te verán en las ligas. Letras, números y _" />
      <Field label="Email" name="email" type="email" error={fe.email} defaultValue={state.values?.email} autoComplete="email" />
      <Field label="Contraseña" name="password" type="password" error={fe.password} autoComplete="new-password" hint="Mínimo 8 caracteres" />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input name="acceptTerms" type="checkbox" className="mt-0.5 h-5 w-5 accent-var" />
        <span>
          Acepto la{" "}
          <Link href="/legal/privacidad" className="text-text underline">
            política de privacidad
          </Link>
          .
          {fe.acceptTerms && <span className="block text-xs text-ko">{fe.acceptTerms}</span>}
        </span>
      </label>
      <button disabled={pending} className={submit}>
        {pending ? "Creando cuenta…" : "Crear cuenta gratis"}
      </button>
    </form>
  );
}

export function SignInForm({ linkError }: { linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {linkError && !state.error && (
        <p className="rounded-xl border border-ko bg-ko-bg px-4 py-3 text-sm">
          El enlace no es válido o ha caducado. Inicia sesión o vuelve a registrarte.
        </p>
      )}
      <Alerts state={state} />
      <Field label="Email" name="email" type="email" error={fe.email} defaultValue={state.values?.email} autoComplete="email" />
      <Field label="Contraseña" name="password" type="password" error={fe.password} autoComplete="current-password" />
      <button disabled={pending} className={submit}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
