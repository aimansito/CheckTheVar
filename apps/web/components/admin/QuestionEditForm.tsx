"use client";

import { QUESTION_STATUSES } from "@checkthevar/shared";
import { useActionState } from "react";
import { STATUS_LABELS } from "@/components/admin/ui";
import { updateQuestion, type AdminFormState } from "@/lib/admin-actions";

export function QuestionEditForm({ id, status, difficulty, note }: { id: number; status: string; difficulty: number; note: string | null }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(updateQuestion, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Estado</legend>
        <div className="grid grid-cols-2 gap-2">
          {QUESTION_STATUSES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold has-checked:border-var has-checked:bg-ok-bg"
            >
              <input type="radio" name="status" value={s} defaultChecked={status === s} className="accent-var" />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Dificultad (1 fácil – 5 muy difícil)</span>
        <select name="difficulty" defaultValue={difficulty} className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Nota de revisión</span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={500}
          rows={3}
          placeholder="Qué falta comprobar, fuente consultada…"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-var"
        />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-var px-5 py-2.5 text-sm font-bold text-bg hover:brightness-110 disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <p role="status" className={`text-sm font-semibold ${state.error ? "text-ko" : "text-var"}`}>
          {state.error ?? state.info}
        </p>
      </div>
    </form>
  );
}
