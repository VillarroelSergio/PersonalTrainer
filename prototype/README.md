# Prototipo navegable — Entrenador híbrido "Tu camino"

Prototipo de alta fidelidad en HTML, CSS y JavaScript nativos, sin dependencias, sin backend y sin proceso de compilación. Todos los datos son ficticios y viven en memoria (`app.js`); nada se persiste entre recargas.

## Cómo abrirlo

**Opción A — doble clic (sin servidor):**
Abre `prototype/index.html` directamente en un navegador (protocolo `file://`). Funciona porque no hay módulos ES, `fetch` de archivos locales ni imports.

**Opción B — servidor estático básico (opcional):**
```
cd prototype
python -m http.server 8080
```
Y visita `http://localhost:8080`.

La referencia visual principal es un iPhone (ancho ~375 px); también funciona en escritorio.

## Flujos navegables (sin recarga de página)

1. **Inicio — "Tu camino"**: estado de la semana (sesiones/minutos/constancia), progreso del bloque, tres opciones (sesión prevista, versión adaptada, recuperación), evolución breve, actividad reciente y logro cercano.
2. **Plan semanal y fases**: pestañas para alternar entre calendario semanal y línea de fases. Desde el calendario: abrir una sesión, omitirla o recolocarla en un día libre; aviso si se intenta recolocar Legs junto a una carrera intensa (domingo).
3. **Sesión de fuerza (Pull)**: lista de 5 ejercicios con estado, y tarjeta individual con variante, objetivo, último resultado, 3 series editables (peso/reps), confirmación serie a serie o edición conjunta, marcador Fácil/Adecuada/Demasiado dura, temporizador de descanso manual y editable, y progreso de sesión en tiempo real.
4. **Cambio de variante**: selector priorizado (favoritas, recientes, mismo patrón, catálogo general) con historial propio de ejemplo al cambiar, más opción secundaria "crear ejercicio personalizado" (no persistente).
5. **Guía técnica y vídeo**: hoja modal con 3-4 indicaciones y músculos implicados; enlace externo simulado a YouTube que abre en pestaña nueva (`target="_blank" rel="noopener"`).
6. **Check-in y adaptación**: energía/motivación/tiempo/molestias; al declarar molestias se revela el mapa corporal frontal/trasero por zonas amplias (zona, lado, intensidad, tipo opcional). La propuesta de adaptación explica cambios y motivo, con decisión explícita: `Aplicar versión adaptada` o `Mantener sesión prevista`.
7. **Cierre e historial**: cierre de sesión con esfuerzo global obligatorio y molestias/comentario opcionales; historial ligero con pestaña de ejemplo de estado vacío y acceso a progreso de un ejercicio (jalón al pecho).

## Datos ficticios incluidos

Objetivo `Ganar músculo`, `Bloque de hipertrofia · semana 3 de 8`, semana con Push completado el lunes, carrera suave el martes, Pull previsto hoy (miércoles), Legs el viernes y carrera larga el domingo. Sesión Pull con jalón al pecho, remo sentado, face pull, pullover en polea y curl de bíceps, cada uno con objetivo y último resultado. Favoritos de variante (jalón al pecho en polea, remo sentado en máquina, extensión de tríceps con cuerda) visibles en el selector de variante. El check-in con energía baja + 40 min + molestia leve en hombro derecho reproduce el ejemplo del encargo: reduce una serie de tirón, cambia face pull a una variante más suave y retira el curl de bíceps.

## Decisiones visuales no especificadas en el encargo

- Paleta oscura con acento naranja/coral energético (`--accent`) para acciones, progreso y logros; conmutador a modo claro en la barra superior.
- Navegación inferior fija (estilo app móvil) con 4 accesos directos (Inicio, Plan, Sesión, Historial); en escritorio se oculta y se usa solo la cabecera.
- Mapa corporal representado con formas SVG abstractas (no anatomía detallada) y botones de zona superpuestos, priorizando zonas amplias y objetivos táctiles ≥44 px.
- El aviso de "Legs junto a carrera intensa" aparece dentro del propio modal de recolocación, con opción de confirmar igualmente o elegir otro día, en vez de bloquear la acción.
- El toggle "Confirmar una a una / Editar todas" en la tarjeta de ejercicio: en modo confirmación cada serie tiene su botón individual; en modo edición aparece un único botón "Confirmar todas las series".
- Solo la sesión Pull de hoy es completamente interactiva (registro de series); el resto de sesiones del calendario (Push, Legs, carreras) abren una vista de resumen de solo lectura, ya que el encargo pide alta fidelidad centrada en el flujo de fuerza.
- El estado vacío del historial se muestra mediante una pestaña de ejemplo ("Ejemplo: sin actividad") en vez de sustituir el historial real, para poder enseñar ambos estados sin perder los datos de demostración.

## Comportamientos simulados (no reales)

- El estado "sin conexión / pendiente de sincronizar" en la cabecera es puramente visual y está etiquetado como simulado; no hay red, cola de cambios ni sincronización real.
- No hay backend, autenticación, base de datos ni importación de archivos FIT/TCX/GPX.
- El vídeo técnico enlaza a una búsqueda de YouTube de ejemplo; no hay reproductor embebido.
- "Crear ejercicio personalizado" muestra una confirmación pero no guarda nada.
- El progreso por ejercicio (modal "Ver progreso") usa una lista de 5 registros ficticios, no un cálculo real.
- Los cambios de plan (omitir/recolocar), el registro de series y el cierre de sesión solo existen en memoria: se pierden al recargar la página.

## Verificación realizada

Ronda 2 (corrección): verificado en un navegador real (Chromium vía Playwright), sirviendo `prototype/` con `python -m http.server 8099` y viewport 375×812. El servidor se detuvo al terminar.

- **Modales**: al cargar, los 4 overlays (`variantModal`, `guideModal`, `progressModal`, `rescheduleModal`) tienen `hidden=true` y `display: none` reales (comprobado con `getComputedStyle`); "Sesión prevista" es pulsable al primer clic. Cada modal probado abre con foco en su primer control interactivo, cierra con ✕, con Escape y con clic en el fondo (backdrop), y devuelve el foco al control que lo abrió. Caso límite encontrado y corregido: al recolocar una sesión, `renderPlan()` reconstruye la tarjeta que abrió el modal antes de que el foco se restaure; `closeModal()` ahora detecta que el elemento original ya no está en el DOM (`isConnected`) y hace foco en el `<h1>` de la vista activa en su lugar, en vez de perderlo en `<body>` (comprobado con y sin el fix).
- **Camino principal**: inicio → sesión → tarjeta de jalón al pecho → confirmar serie 1 → contador pasa de 0/3 a 1/3 (comprobado leyendo el DOM) → descanso: `restDisplay` se mantiene estático en "1:30" hasta pulsar "Iniciar descanso", y baja a "1:26" segundos después de pulsarlo → terminar sesión → cerrar con esfuerzo "Moderado" → vuelve a Inicio.
- **Camino de adaptación**: check-in con energía baja/40 min/molestia leve → el mapa corporal permanece oculto hasta declarar la molestia (`bodyMapSection.hidden` pasa a `false` solo entonces) → zona "Hombro der." → propuesta "Pull adaptado · 40 min" con los cambios esperados → probado por separado: `Aplicar versión adaptada` (añade el badge "Sesión adaptada") y `Mantener sesión prevista` (sin badge, sin cambios aplicados).
- **Plan semanal**: "Omitir" en carrera larga → badge pasa a "Omitida". "Recolocar" Legs a sábado → aviso real "colocar Legs junto a una carrera intensa..." (domingo es carrera larga) → confirmar igualmente → viernes queda "Recolocada", sábado pasa a "Legs · Planificada".
- **Historial**: pestaña "Ejemplo: sin actividad" muestra el estado vacío ("Todavía no hay sesiones registradas") sin perder los datos de la pestaña con actividad.
- **`scrollWidth === clientWidth`** comprobado en las 9 vistas (`home`, `plan`, `daySummary`, `session`, `exercise`, `checkin`, `adaptation`, `close`, `history`) a 375 px: sin desbordamiento horizontal en ninguna.
- **Mapa corporal**: `getBoundingClientRect()` de los 11 botones de zona (vista frontal) y los 7 (vista trasera) sin ningún par solapado (comprobación por pares de rectángulos, `overlaps: []` en ambas vistas). Antes del ajuste de ancho fijo (72 px) y `white-space: normal`, el par rodilla/tobillo sí solapaba, tal como reportó el revisor; ahora tiene 12 px de margen.
- **Contraste sobre `--accent`/`--accent-strong` sólidos** — ronda 3 (corrección de la causa raíz): se introdujo una variable única `--on-accent: #000000` (definida una sola vez en `:root`, ya que el mismo valor supera 4.5:1 en los dos temas) y se aplicó a los tres sitios que pintan texto sobre esos colores sólidos: `.primary-btn`, `.segmented__btn.is-selected` y `.zone-btn.is-selected`. Se revisó el resto del CSS (`grep` de `var(--accent`/`var(--accent-strong)` y de `color: #fff`) y no quedaba ningún otro texto sobre fondo sólido de acento sin corregir. Ratios medidos con `getComputedStyle` sobre elementos reales y seleccionados de verdad (energía "Baja" en el check-in, zona "Hombro der." tras declarar molestia leve, botón "Ver propuesta" para el degradado del `.primary-btn`):
  - `.segmented__btn.is-selected`: oscuro 8.12:1, claro 6.05:1 (fuente real 13.6px).
  - `.zone-btn.is-selected`: oscuro 8.12:1, claro 6.05:1 (fuente real 11.2px, el peor caso original del revisor).
  - `.primary-btn`: oscuro 8.12:1 (extremo `--accent`) / 6.93:1 (extremo `--accent-strong`); claro 6.05:1 / 4.62:1 (extremo `--accent-strong`, el peor caso de toda la interfaz) — sin degradar respecto a la ronda anterior.
  - Todos los pares ≥4.5:1 AA en ambos temas. Estado seleccionado sigue siendo visualmente evidente sin depender del color de texto: relleno naranja sólido (`rgb(255,122,69)` oscuro / `rgb(226,99,42)` claro) frente al fondo neutro elevado del estado no seleccionado (comprobado con `getComputedStyle` comparando un botón seleccionado y uno sin seleccionar). No hay reglas `:hover` específicas para estas clases que pudieran verse afectadas; el único `:focus-visible` global (contorno naranja) no cambió.
- **Consola**: 0 errores propios en toda la sesión de pruebas; el único mensaje registrado es el 404 de `favicon.ico` al servir por HTTP (no cuenta como hallazgo, como se indicó).
- Lectura completa de `index.html` y `app.js`: todos los `id` referenciados por `document.getElementById` en `app.js` existen en `index.html` (comparación automática de listas de identificadores; sin discrepancias). Sin `console.log` ni referencias remotas obligatorias.
- `node --check app.js`: sin errores de sintaxis.

**Persiste sin verificar in-browser**: el clic real de puntero sobre el backdrop del modal se probó por evento sintético con `e.target === overlay` (la misma condición que usa el código), no con un clic de ratón en coordenadas reales fuera de la caja del modal; el comportamiento en Safari/iOS real (solo se probó Chromium) y en lectores de pantalla no se ha probado.
