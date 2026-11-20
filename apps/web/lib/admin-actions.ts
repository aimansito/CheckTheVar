"use server";

import { adminQuestionUpdateSchema, adminReportSchema } from "@checkthevar/shared";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminFormState = { error?: string; info?: string };

async function logAction(adminId: string, action: string, target: string, detail: Record<string, unknown>) {
  await getSupabaseAdmin().from("admin_actions").insert({ admin_id: adminId, action, target, detail });
}

/** Estado, dificultad y nota de revisión de una pregunta. */
export async function updateQuestion(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = adminQuestionUpdateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisa los datos." };
  const { id, status, difficulty, note } = parsed.data;

  const db = getSupabaseAdmin();
  const { data: before } = await db.from("questions").select("status, difficulty, review_note").eq("id", id).maybeSingle();
  if (!before) return { error: "Esa pregunta ya no existe." };

  const { error } = await db
    .from("questions")
    .update({
      status,
      difficulty,
      review_note: note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      ...(status === "published" && before.status !== "published" ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };

  await logAction(admin.id, "question.update", `question:${id}`, {
    from: { status: before.status, difficulty: before.difficulty },
    to: { status, difficulty },
    note: note || null,
  });
  revalidatePath("/admin", "layout");
  return { info: "Guardado." };
}

/** Cambio rápido de estado desde la lista (publicar / retirar). */
export async function setQuestionStatus(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = adminQuestionUpdateSchema.pick({ id: true, status: true }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { id, status } = parsed.data;

  const db = getSupabaseAdmin();
  const { data: before } = await db.from("questions").select("status").eq("id", id).maybeSingle();
  if (!before || before.status === status) return;
  await db
    .from("questions")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", id);
  await logAction(admin.id, "question.status", `question:${id}`, { from: before.status, to: status });
  revalidatePath("/admin", "layout");
}

/** Cerrar un reporte: resuelto (se corrigió algo) o descartado (no había error). */
export async function resolveReport(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = adminReportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { id, resolution } = parsed.data;

  const { data } = await getSupabaseAdmin()
    .from("question_reports")
    .update({ status: resolution, resolved_at: new Date().toISOString(), resolved_by: admin.id })
    .eq("id", id)
    .eq("status", "open")
    .select("question_id")
    .maybeSingle();
  if (!data) return;
  await logAction(admin.id, `report.${resolution}`, `report:${id}`, { questionId: data.question_id });
  revalidatePath("/admin", "layout");
}
