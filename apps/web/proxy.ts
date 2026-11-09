import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_PATHS,
  GUEST_TOKEN_RE,
  guestCookieOptions,
  newGuestToken,
} from "@/lib/game/guest-cookie";

/**
 * 1) Da cookie de invitado en las rutas de juego ANTES de que lleguen peticiones en paralelo
 *    (si no, dos `start` simultáneos crearían dos invitados distintos).
 * 2) Refresca la sesión de Supabase (renueva el token y reescribe cookies).
 * No decide permisos: eso lo hacen las rutas y la BD (RLS).
 */
export async function proxy(request: NextRequest) {
  let guestToken: string | null = null;
  const needsGuest = GUEST_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (needsGuest && !GUEST_TOKEN_RE.test(request.cookies.get(GUEST_COOKIE)?.value ?? "")) {
    guestToken = newGuestToken();
    request.cookies.set(GUEST_COOKIE, guestToken);
  }
  const withGuest = (res: NextResponse) => {
    if (guestToken) res.cookies.set(GUEST_COOKIE, guestToken, guestCookieOptions);
    return res;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return withGuest(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Importante: no meter lógica entre createServerClient y getUser (lo pide @supabase/ssr).
  await supabase.auth.getUser();
  return withGuest(response);
}

export const config = {
  // Todo menos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wav|mp4)$).*)"],
};
