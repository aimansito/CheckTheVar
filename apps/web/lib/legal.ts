/**
 * Textos legales de CHECK THE VAR (RGPD, LOPDGDD y LSSI-CE).
 *
 * IMPORTANTE: antes de abrir la web al público hay que rellenar los datos del titular
 * (`LEGAL_OWNER`) y que una persona responsable revise los textos. Los campos entre
 * corchetes no se inventan: si faltan, la página lo muestra tal cual.
 */

export const LEGAL_OWNER = {
  name: "[Nombre y apellidos o razón social del titular]",
  taxId: "[NIF]",
  address: "[Domicilio]",
  email: "privacidad@checkthevar.app",
  site: "checkthevar.app",
} as const;

export const LEGAL_UPDATED = "11 de noviembre de 2026";

export type LegalSection = { title: string; body: (string | string[])[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

const o = LEGAL_OWNER;

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacidad: {
    title: "Política de privacidad",
    intro:
      "Aquí te contamos qué datos usa CHECK THE VAR, para qué, durante cuánto tiempo y qué puedes hacer con ellos. Lo hemos escrito para que se entienda sin ser abogado.",
    sections: [
      {
        title: "1. Quién es el responsable",
        body: [
          `El responsable del tratamiento es ${o.name}, con NIF ${o.taxId} y domicilio en ${o.address}.`,
          `Para cualquier cosa relacionada con tus datos escríbenos a ${o.email}.`,
        ],
      },
      {
        title: "2. Qué datos tratamos",
        body: [
          "Solo los necesarios para que puedas jugar:",
          [
            "Datos de cuenta: nombre de jugador, email y nivel de dificultad elegido. La contraseña se guarda cifrada (hash) por nuestro proveedor de autenticación; nosotros no podemos verla.",
            "Si entras con Google o Apple: el email y el identificador que nos facilita ese servicio. No recibimos tu contraseña de Google ni de Apple.",
            "Datos de juego: partidas, respuestas, tiempos de respuesta, puntos, rachas, marcas y ligas en las que participas.",
            "Si juegas sin cuenta: un identificador aleatorio guardado en una cookie técnica. En nuestra base de datos solo guardamos un resumen cifrado (hash) de ese identificador.",
            "Datos técnicos: dirección IP, usada de forma temporal para limitar el número de peticiones y evitar abusos, y registros técnicos de errores.",
          ],
          "No pedimos datos especialmente protegidos ni hacemos perfiles con fines publicitarios.",
        ],
      },
      {
        title: "3. Para qué los usamos y con qué base legal",
        body: [
          [
            "Crear y gestionar tu cuenta, guardar tus puntos, rachas y marcas, y que puedas jugar ligas con tus amigos. Base legal: la ejecución del servicio que nos pides al registrarte (art. 6.1.b RGPD).",
            "Traspasar a tu cuenta los puntos que hiciste como invitado al registrarte. Base legal: la ejecución del servicio.",
            "Proteger el juego: limitar peticiones, detectar respuestas imposibles (por ejemplo, respuestas repetidas en menos de 0,4 segundos) y revisar cuentas sospechosas de hacer trampas. Base legal: nuestro interés legítimo en que la competición sea justa y el servicio seguro (art. 6.1.f RGPD).",
            "Enviarte los emails imprescindibles del servicio: confirmar la cuenta y recuperar la contraseña. Base legal: la ejecución del servicio.",
          ],
          "Si una cuenta queda marcada por posibles trampas, lo revisa una persona. No tomamos decisiones automáticas que te afecten de forma significativa.",
          "Hoy no usamos analítica ni publicidad. Si algún día lo hacemos, te pediremos antes tu consentimiento.",
        ],
      },
      {
        title: "4. Quién puede ver tus datos",
        body: [
          "Tu nombre de jugador, tus puntos y tu posición son visibles para los miembros de las ligas a las que te unas. Tu email no se muestra a nadie.",
          "Para prestar el servicio usamos proveedores que tratan datos por cuenta nuestra, con contrato de encargado del tratamiento:",
          [
            "Supabase: base de datos y autenticación, con los datos alojados en la Unión Europea (Fráncfort, Alemania).",
            "Vercel: alojamiento de la web.",
            "Upstash: almacenamiento temporal para limitar peticiones, si está activado.",
            "Google y Apple: solo si eliges entrar con ellos.",
          ],
          "Algunos de estos proveedores pueden acceder a datos desde fuera del Espacio Económico Europeo. En ese caso se ampara en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo aprobadas por la Comisión Europea.",
          "No vendemos ni cedemos tus datos a terceros.",
        ],
      },
      {
        title: "5. Cuánto tiempo los guardamos",
        body: [
          [
            "Datos de cuenta y de juego: mientras tengas la cuenta. Si la borras, eliminamos tus datos personales y anonimizamos tus partidas, que solo se conservan para estadísticas sin identificarte.",
            "Datos de invitado: el identificador de la cookie dura un año. Si no te registras, los datos asociados se eliminan pasado ese plazo.",
            "Datos técnicos de límite de peticiones: desde unos minutos hasta una hora.",
            "Cuando la ley nos obligue a conservar algo (por ejemplo, ante una reclamación), lo guardaremos bloqueado solo el tiempo necesario.",
          ],
        ],
      },
      {
        title: "6. Tus derechos",
        body: [
          `Puedes pedirnos en cualquier momento el acceso, la rectificación o la supresión de tus datos, la limitación del tratamiento, la portabilidad y oponerte al tratamiento basado en interés legítimo. Escríbenos a ${o.email} desde el email de tu cuenta; te responderemos en el plazo máximo de un mes.`,
          "Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).",
        ],
      },
      {
        title: "7. Menores de edad",
        body: [
          "Para crear una cuenta tienes que tener al menos 14 años. Si eres menor de 14, necesitas el consentimiento de tu madre, padre o tutor. Si detectamos una cuenta de un menor de 14 años sin ese consentimiento, la eliminaremos.",
        ],
      },
      {
        title: "8. Seguridad",
        body: [
          "Usamos conexiones cifradas (HTTPS), contraseñas cifradas, permisos por fila en la base de datos para que cada jugador solo acceda a lo suyo y límites de peticiones. Ningún sistema es infalible; si ocurriera una brecha que te afecte, te avisaremos y lo comunicaremos a la autoridad cuando corresponda.",
        ],
      },
      {
        title: "9. Cambios en esta política",
        body: [
          "Si cambiamos algo importante, lo verás aquí con la fecha actualizada y, si afecta a tu cuenta, te avisaremos por email.",
        ],
      },
    ],
  },
  cookies: {
    title: "Política de cookies",
    intro:
      "Una cookie es un pequeño archivo que la web guarda en tu navegador. CHECK THE VAR solo usa las imprescindibles para funcionar.",
    sections: [
      {
        title: "1. Cookies que usamos",
        body: [
          [
            "ctv_guest (propia, técnica, 1 año): identificador aleatorio para que puedas jugar el reto diario sin cuenta y guardar tus puntos si después te registras.",
            "sb-…-auth-token (propia, técnica, mientras dure la sesión): mantiene tu sesión iniciada. Solo existe si entras con tu cuenta.",
          ],
          "Son cookies técnicas, necesarias para el servicio que nos pides, y por eso no requieren tu consentimiento (art. 22.2 LSSI-CE).",
        ],
      },
      {
        title: "2. Lo que no usamos",
        body: [
          "No usamos cookies de analítica, publicidad ni redes sociales. Si en el futuro las añadimos, te mostraremos un aviso para que elijas antes de activarlas.",
        ],
      },
      {
        title: "3. Cómo borrarlas",
        body: [
          "Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas las técnicas, no podrás jugar como invitado ni mantener la sesión iniciada.",
        ],
      },
    ],
  },
  aviso: {
    title: "Aviso legal",
    intro: "Información sobre el titular de CHECK THE VAR y las condiciones de uso de la web.",
    sections: [
      {
        title: "1. Titular",
        body: [
          [
            `Titular: ${o.name}`,
            `NIF: ${o.taxId}`,
            `Domicilio: ${o.address}`,
            `Email de contacto: ${o.email}`,
            `Sitio web: ${o.site}`,
          ],
        ],
      },
      {
        title: "2. Uso de la web",
        body: [
          "CHECK THE VAR es un juego de preguntas sobre fútbol. Al usarlo te comprometes a jugar de forma limpia: no usar programas automáticos, no intentar manipular las respuestas ni los tiempos y no acceder a cuentas de otras personas. Podemos suspender las cuentas que incumplan estas normas.",
          "Tu nombre de jugador no puede ser ofensivo ni suplantar a otra persona. Si lo es, podemos cambiarlo.",
        ],
      },
      {
        title: "3. Contenido y marcas",
        body: [
          "CHECK THE VAR es un juego independiente y no tiene relación con ninguna liga, club, federación ni con la FIFA o la UEFA. Los nombres de jugadores, clubes y competiciones se usan solo para identificar los hechos sobre los que se pregunta.",
          "Los datos futbolísticos proceden de fuentes públicas que citamos en cada dato. Si encuentras un error, puedes reportarlo y lo revisaremos.",
          "El diseño, el logotipo y los textos propios de CHECK THE VAR pertenecen a su titular.",
        ],
      },
      {
        title: "4. Responsabilidad",
        body: [
          "Hacemos lo posible para que las preguntas sean correctas y el servicio esté disponible, pero no podemos garantizar que no haya errores ni interrupciones.",
        ],
      },
      {
        title: "5. Ley aplicable",
        body: ["Estas condiciones se rigen por la legislación española."],
      },
    ],
  },
};
