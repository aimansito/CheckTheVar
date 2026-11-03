export type QuizItem = {
  slug: string;
  hook: string;
  hook_accent?: string;
  category: string;
  category_label: string;
  difficulty: number;
  prompt_es: string;
  options_es: string[];
  correct_index: number;
  explanation_es: string;
  cta: string;
  source: string;
};

/** Valida una pregunta del lote. Lanza un error legible si algo no cuadra. */
export function assertQuizItem(value: unknown): QuizItem {
  const v = value as Partial<QuizItem>;
  const errors: string[] = [];
  if (typeof v.slug !== "string" || !/^[a-z0-9-]+$/.test(v.slug)) errors.push("slug");
  if (typeof v.hook !== "string" || v.hook.length === 0) errors.push("hook");
  if (typeof v.category_label !== "string") errors.push("category_label");
  if (typeof v.prompt_es !== "string" || v.prompt_es.length > 120) errors.push("prompt_es (≤120)");
  if (!Array.isArray(v.options_es) || v.options_es.length !== 3) errors.push("options_es (3)");
  if (
    typeof v.correct_index !== "number" ||
    v.correct_index < 0 ||
    v.correct_index >= (v.options_es?.length ?? 0)
  )
    errors.push("correct_index");
  if (typeof v.explanation_es !== "string" || v.explanation_es.length > 140)
    errors.push("explanation_es (≤140)");
  if (typeof v.cta !== "string") errors.push("cta");
  if (errors.length) throw new Error(`Pregunta inválida (${v.slug ?? "?"}): ${errors.join(", ")}`);
  return v as QuizItem;
}
