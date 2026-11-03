---
name: marca-ui
description: Identidad visual y tono de CHECK THE VAR. Úsala al crear o modificar cualquier pantalla, componente, botón, landing, icono o texto de interfaz.
---

# Marca y UI de CHECK THE VAR

## Colores (tokens)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0D0B` | Fondo principal (casi negro) |
| `--surface` | `#111613` | Tarjetas |
| `--bezel` | `#1C2420` | Marco del monitor, superficies elevadas |
| `--line` | `#2C3832` | Bordes |
| `--screen` | `#04110A` | Interior de la pantalla del VAR |
| `--text` | `#F4F7F5` | Texto principal |
| `--text-muted` | `#B7C2BC` | Texto secundario |
| `--var-green` | `#39E27A` | Acento: VAR, aciertos, botones primarios |
| `--goal-ok-bg` | `#12391F` | Fondo de opción correcta |
| `--goal-ko` | `#F87171` | Fallo / gol anulado |
| `--goal-ko-bg` | `#3A1414` | Fondo de fallo |

Modo oscuro por defecto. Contraste mínimo AA.

## Tipografía
- Titulares, logo, botón del VAR y resultados: **Anton** (Google Fonts), mayúsculas.
- Texto de interfaz: **Inter** 400/500/600/700.

## Logo
- Principal: "CHECK" / "THE" en dos líneas (Anton, blanco) a la izquierda + monitor a la
  derecha: marco `--bezel`, pantalla `--screen` con líneas de escaneo sutiles, cuatro esquinas
  en verde (el rectángulo del VAR), "VAR" en verde con brillo suave, pie y base del monitor.
- Isotipo / favicon: solo la pantalla con "VAR". A 16–32 px se puede usar solo "V".
- Nunca deformar, cambiar la tipografía ni añadir escudos o balones de marcas reales.

## Componentes clave
- **Botón CHECK THE VAR:** fondo `--text`, texto "CHECK THE" en `--bg` + "VAR" en una
  pastilla `--screen` con texto verde. Deshabilitado hasta que haya respuesta elegida.
- **Revisión:** "Revisando la jugada…" sobre `--screen` con borde verde, 1–2 s
  (versión corta tras las primeras partidas; desactivable en ajustes; respetar
  `prefers-reduced-motion`).
- **Resultado:** "GOL CONFIRMADO" (fondo verde, texto oscuro, puntos ganados) o
  "GOL ANULADO" (fondo `--goal-ko-bg`, respuesta correcta + dato curioso).
- Áreas táctiles de al menos 44 px. Diseño mobile-first.

## Tono de los textos
Cercano, futbolero y con humor, sin burlarse del usuario. Vocabulario de partido:
jornada, racha, hat-trick, gol confirmado/anulado, revisión, vestuario, clasificación.
Ejemplos: "Gol confirmado. +120", "Anulado por poco. Era España.", "Hat-trick. Racha de 3".
