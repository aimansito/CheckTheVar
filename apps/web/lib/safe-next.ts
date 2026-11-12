/** Solo rutas internas: evita redirecciones abiertas desde un parámetro `next`. */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/(?!\/)[\w\-/?=&]*$/.test(next) ? next : null;
}
