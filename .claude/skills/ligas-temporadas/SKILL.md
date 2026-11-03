---
name: ligas-temporadas
description: Reglas de ligas por temporada en CHECK THE VAR - creación, jornadas temáticas, enfrentamientos, copa, cierre de jornada, clasificación, ascensos y trofeos. Úsala al implementar cualquier parte de ligas.
---

# Ligas por temporada

## Estructura
- `leagues`: privadas (código de invitación, máx. 20 por defecto) o públicas.
- `league_seasons`: 10–12 jornadas semanales; cada temporada puede tener temática.
- `matchdays`: una por semana, con `category_id` (Liga, Champions, Mundial…), `opens_at`,
  `closes_at` y 10 preguntas en `matchday_questions` (iguales para toda la liga).

## Formatos
- `points`: la clasificación ordena por puntos de juego acumulados.
- `head_to_head`: calendario de enfrentamientos (todos contra todos, método round-robin).
  Por jornada: más puntos de juego gana (3), igual empata (1), menos pierde (0).
  Con número impar de jugadores, uno descansa (`away_user_id = null`) y suma 0.
  Desempate: diferencia de puntos de juego → aciertos totales → menor tiempo medio.

## Copa
A mitad de temporada, eliminatoria a partido único con jornadas `is_cup_round = true`.
Emparejamientos según la clasificación (1.º contra último…).

## Cierre de jornada (job en servidor al llegar `closes_at`)
1. Partidas de la jornada no jugadas → 0 puntos.
2. Calcular `matchday_results` y resolver `fixtures`.
3. Recalcular `standings` en una transacción.
4. Notificar: resultado, posición y rival de la siguiente jornada.

## Fin de temporada
- Campeón → `league_seasons.champion_user_id` + trofeo en `user_trophies`.
- Trofeos extra: máximo acertante, mejor racha, ganador de copa.
- Ligas públicas: los `promote_count` primeros ascienden, los `relegate_count` últimos descienden.
- La liga privada continúa con la temporada siguiente salvo que el dueño la cierre.

## Comunicación
Mensajes con vocabulario de partido: "Jornada 7 cerrada: ganaste 3-1 a Javi",
"Estás en puestos de ascenso", "Final de copa este jueves".
