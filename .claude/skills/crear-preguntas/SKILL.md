---
name: crear-preguntas
description: Cómo crear, verificar, clasificar y cargar preguntas de fútbol para CHECK THE VAR (manuales o generadas desde los datos). Úsala al redactar preguntas, generar lotes, importar JSON o revisar reportes de preguntas erróneas.
---

# Crear preguntas

## Principio número uno: nada inventado
Cada dato debe poder verificarse en una fuente fiable. Si no estás seguro de un dato,
**no lo uses**: deja la pregunta en `draft` y anota qué falta por verificar.
Preferir datos cerrados (finales jugadas, premios entregados, temporadas terminadas)
frente a datos que cambian (goles de un jugador en activo, récords vigentes).

## Categorías (slugs)
`liga`, `champions`, `mundial`, `eurocopa`, `otras-competiciones`, `historia-jugadores`,
`premios-individuales`, `premios-colectivos`, `records`, `trayectorias`, `fichajes`.

## Dificultad (1–5)
1 = cualquiera que vea fútbol · 3 = aficionado habitual · 5 = experto.
Tras publicar, `question_stats` recalibra: si acierta más del 85 %, bajar dificultad;
si menos del 20 %, subirla.

## Formato de importación (JSON)
```json
{
  "category": "mundial",
  "competition": "Copa Mundial de la FIFA",
  "format": "multiple_choice",
  "difficulty": 1,
  "era": [2010, 2010],
  "prompt_es": "¿Qué selección ganó el Mundial de 2010?",
  "options_es": ["Países Bajos", "España", "Alemania"],
  "correct_index": 1,
  "explanation_es": "España ganó la final 1-0 en la prórroga.",
  "entities": { "teams": ["España", "Países Bajos"] },
  "source": "URL o referencia de la fuente",
  "status": "review"
}
```

## Reglas de redacción
- Enunciado de 120 caracteres como máximo; una sola respuesta correcta indiscutible.
- 3 o 4 opciones plausibles, de la misma clase (todo selecciones, todo años…).
- Sin trampas de redacción ni dobles negaciones.
- Explicación breve (≤ 140 caracteres) con un dato curioso verificable.
- Precios de fichajes: indicar "aprox." si la cifra es estimada; preferir preguntas de
  "más o menos" a cifras exactas.
- Para texto libre, incluir todas las variantes aceptadas y alias del jugador.

## Preguntas generadas desde datos
Plantillas con `generator_key`, por ejemplo:
- `club_before_transfer`: "¿En qué club jugaba X antes de fichar por Y?" (desde `transfers`)
- `award_winner_year`: "¿Quién ganó el premio X en el año Y?" (desde `award_winners`)
- `competition_champion`: "¿Quién ganó la competición X en la temporada Y?"
Generar opciones incorrectas de la misma liga y época. Toda pregunta generada pasa por
`review` antes de `published`.

## Flujo
draft → review → published → (retired si el dato cambia o hay reportes confirmados).
Al llegar a 3 reportes abiertos, retirarla automáticamente hasta revisión.
