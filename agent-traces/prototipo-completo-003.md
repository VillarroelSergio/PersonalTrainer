# Traza de agentes — prototipo navegable completo (003)

Estado: pendiente de aprobación humana

## Metadatos

- Objetivo: construir el prototipo navegable completo del MVP de Trainer, cubriendo las 29 piezas del mapa UX de `obsidian/Trainer UX/` como flujos navegables y verificables, sin backend ni dependencias.
- Fecha de inicio: 8 de agosto de 2026.
- Orquestador: Opus · esfuerzo medio (seleccionado y declarado antes de delegar).
- Implementadores y revisores: Sonnet · esfuerzo medio (declarado al delegar).
- Límite de correcciones por causa: 2.
- Documentos fuente, leídos en el orden exigido: `AGENTS.md`, `MVP-DEFINITION.md`, `CLAUDE.md`, `LOOP-ENGINEERING.md`, `obsidian/Trainer UX/00 - Mapa de flujos.canvas`, `obsidian/Trainer UX/Flujos/26 - Cobertura y validación UX.md`, las notas 01–29 y 99 de `obsidian/Trainer UX/Flujos/`, `INTERVIEW-001-SERGIO.md`, y los archivos actuales de `prototype/`.
- Trazas previas: `agent-traces/prototipo-clicable-001.md`, `agent-traces/rediseno-prototipo-002.md`.

## 0. Contradicciones detectadas entre fuentes

| # | Contradicción | Resolución |
|---|---|---|
| 1 | `MVP-DEFINITION.md` §6 ordena el inicio como "1) estado de la semana, 2) próximas opciones". La nota `28 - Tu camino y estado semanal.md` fija la prioridad "1) qué continuar o hacer ahora, 2) opciones, 3) cómo va la semana", y el encargo pide la sesión de hoy como protagonista. | No se resuelve inventando: la nota 28 es fuente de verdad UX, coincide con el encargo vigente y el usuario ya decidió el 2026-08-08 ("el protagonista tiene que ser la sesión del día primero"). Se aplica la nota 28. `MVP-DEFINITION.md` §6 queda desactualizado y debería corregirse en una tarea aparte de documentación. |
| 2 | La nota `09 - Historial y progreso.md` dice que peso y medidas "no forman parte del MVP si amplían el alcance actual", mientras la nota `27 - Métricas personales opcionales.md` y el punto 27 del encargo las exigen como flujo navegable. | No es contradicción real: la 27 las delimita como opcionales, privadas y sin efecto sobre las recomendaciones, que es exactamente la condición de la 09. Se implementan con ese límite explícito. |

No se ha detectado ninguna contradicción bloqueante que exija detener el trabajo.

## 1. Plan de Opus

### Alcance

Reescritura y ampliación de `prototype/` hasta cubrir las 29 piezas del mapa UX como flujos navegables. Actualización de `prototype/README.md` con la tabla de cobertura de 29 filas. Esta traza en `agent-traces/`.

### Fuera de alcance

Nada fuera de `prototype/` y `agent-traces/`. Sin dependencias, compilación, red, backend, base de datos, autenticación real, parser real de FIT/TCX/GPX/CSV, Service Worker real, APIs, credenciales ni servicios cloud. Sin chat/asistente, nutrición, diagnóstico, GPS, mapas, rutas, red social, rankings, notificaciones push, integración directa con relojes, inventario de gimnasio ni colaboración en tiempo real. Sin commit, push, despliegue ni publicación.

### Arquitectura decidida por Opus

El monolito actual (`index.html` de 28 KB con las vistas en línea + `app.js` de 64 KB) no soporta ~40 vistas ni permite repartir la propiedad de archivos entre lotes. Se reestructura:

```
prototype/
  index.html        cascarón: topbar, navegación, <main> vacío, host de hojas modales
  styles.css        sistema visual único
  js/data.js        dataset ficticio, estado en memoria, persistencia simulada y reinicio de demo
  js/core.js        router sin recarga, helpers DOM, hojas modales/foco, toast, estados globales
  js/views/*.js     una vista o área por archivo
  README.md         tabla de cobertura de 29 filas con ruta de prueba y resultado
```

Scripts clásicos en orden con `<script src>`, sin módulos ES, sin `fetch` y sin imports, para que `file://` siga funcionando con doble clic.

### Criterios de aceptación, fijados antes de construir

| # | Criterio |
|---|---|
| A1 | Las 7 áreas del encargo son rutas navegables sin recarga: acceso/onboarding, Tu camino, Plan, Entrenar, Ejercicios, Historial, Perfil |
| A2 | Las 29 piezas del mapa UX existen como flujo navegable, no como tarjeta decorativa: cada acción produce el estado descrito |
| A3 | Recolocar no duplica sesiones ni altera el total previsto; omitir y deshacer se comportan según la nota 15 |
| A4 | Los estados de sesión (planificada, en curso, completada, adaptada, parcial, omitida, recolocada) son idénticos en plan, inicio, carril e historial (nota 29) |
| A5 | Mapa corporal oculto hasta declarar molestia; aviso de bienestar general ante molestia importante, sin diagnóstico |
| A6 | Fuerza: dos modos de registro, temporizador solo iniciado por la persona, cambio de variante, omitir, añadir, reordenar y cierre parcial |
| A7 | Importación simulada con los cinco caminos: válido, formato no admitido, inválido, duplicado y cancelado |
| A8 | Compartir genera enlace simulado, vista previa, copia independiente que se puede adaptar sin afectar al original, y revocación |
| A9 | Estados locales/pendiente/sincronizado/conflicto/error recuperable, instalación y actualización simuladas y etiquetadas como simulación |
| A10 | Accesibilidad: foco visible, orden de tabulación lógico, pestañas con flechas, ARIA coherente, modales con foco inicial/Escape/devolución, estados no solo por color, contraste AA |
| A11 | Sin scroll horizontal a 375 px y a 1440 px; sin errores propios en consola; enlaces externos con `target="_blank"` y `rel="noopener"`; sin red obligatoria |
| A12 | Acción visible de reinicio de la demo; `localStorage` etiquetado como simulación |
| A13 | Revisión independiente de producto, UX/accesibilidad y seguridad/alcance, distinta del implementador, en el cierre |

### Lotes y propiedad de archivos

Los lotes se ejecutan **en serie**, nunca en paralelo. En cada momento un único implementador escribe; los revisores son de solo lectura.

| Lote | Contenido | Archivos que posee el implementador |
|---|---|---|
| 1 | Base visual, cascarón, router, datos simulados, estados globales, acceso/onboarding, Tu camino | `index.html`, `styles.css`, `js/data.js`, `js/core.js`, `js/views/access.js`, `js/views/home.js` |
| 2 | Creador guiado, ciclo de vida del plan y fases, calendario completo | `js/views/plan.js`, `js/views/plan-builder.js` + adiciones a `data.js` |
| 3 | Check-in, mapa corporal, recuperación y sesión de fuerza completa | `js/views/checkin.js`, `js/views/recovery.js`, `js/views/strength.js` |
| 4 | Catálogo, ficha/guía, variantes, ejercicio propio y progresión | `js/views/library.js` |
| 5 | Resistencia, segmentos e importación simulada | `js/views/endurance.js`, `js/views/import.js` |
| 6 | Historial, adherencia, logros, métricas, compartir, perfil, offline/procedencia y pulido | `js/views/history.js`, `js/views/profile.js`, `js/views/share.js`, `README.md` |

### Riesgos que requieren decisión humana

1. Ninguno abierto en el momento de planificar. La contradicción del orden de Inicio ya fue decidida por el usuario y queda registrada arriba.

## 2. Intervenciones

Limitación transversal, declarada una sola vez: la interfaz no permite fijar el esfuerzo de un subagente. El orquestador lo declaró en cada delegación y cada subagente lo confirmó en su bloque de traza, pero no es verificable técnicamente.

### 1 a 6 — Implementadores de los lotes 1 a 6

- Rol: implementador (seis agentes distintos, uno por lote, ejecutados **en serie**)
- Modelo y esfuerzo: Sonnet · medio
- Archivos modificados: los asignados en la tabla de propiedad del plan; ningún lote escribió fuera de ella.
- Resumen de trabajo: lote 1, cascarón, router, datos y acceso/Tu camino; lote 2, creador guiado, ciclo de vida del plan y calendario; lote 3, check-in, mapa corporal, recuperación y sesión de fuerza; lote 4, catálogo, ficha, variantes y progresión; lote 5, resistencia, segmentos e importación; lote 6, historial, adherencia, logros, métricas, compartir, perfil y `README.md`.
- Verificación ejecutada y resultado: cada lote devolvió evidencia medida en navegador. Defectos encontrados y corregidos dentro de su propio lote: ruptura de identidad de objetos tras recargar desde `localStorage` (lote 3), `App.states.empty/error` borraba el encabezado de la vista (lotes 5 y 6), la conmutación de pestañas del historial apilaba contenido duplicado (lote 6), y el foco no aterrizaba en el campo inválido en el modo "editar todas" (lote 3).
- Resultado para Opus: completado.

### 7 — Revisor de producto (independiente)

- Rol: revisor de producto · Sonnet · medio · solo lectura
- Archivos modificados: ninguno.
- Verificación ejecutada y resultado: contraste de las 29 filas de la tabla de cobertura contra el código; ninguna fila resultó falsa. Invariantes trazados y confirmados: `moveSession` muta `day` y anota `movedFrom` sin crear objetos; `undoLastAction` restaura el estado previo; `adherenceSummary` suma completadas y adaptadas y excluye parciales y omitidas; `createRoutineCopy` clona en profundidad y es independiente en ambos sentidos; `correctHistoryEntry` versiona antes de sobrescribir; `loadContext` no muta el plan; `suggestNextReference` está aislado por variante. Estados de sesión: exactamente los seis previstos, con `movedFrom` como campo aparte y no como séptimo estado. Alcance prohibido: sin hallazgos reales.
- Hallazgos no bloqueantes: deshacer es un único slot global, no una pila; siete piezas tenían evidencia de clic de rondas anteriores; el contraste nota a nota de las 29 notas de Obsidian no se hizo de forma exhaustiva.
- Resultado para Opus: completado.

### 8 — Revisor de UX y accesibilidad (independiente)

- Rol: revisor UX · Sonnet · medio · solo lectura
- Archivos modificados: ninguno.
- Limitación declarada por el propio revisor: su definición de agente no incluye herramienta de navegador, así que hizo revisión estática de código y cálculo manual de contraste. La verificación en navegador la asumió Opus (sección 3).
- Verificación ejecutada y resultado: tres grupos de pestañas con `role="tab"`, `aria-selected`, tabindex roving y flechas; hojas modales con foco inicial dentro, atrapado, Escape y devolución; `aria-pressed` en selectores, zonas del mapa corporal y conmutadores; dos enlaces externos a YouTube, ambos `target="_blank" rel="noopener"`, cero `iframe`; contrastes calculados sobre los valores reales, todos por encima de AA.
- Hallazgos: (1) alto, `overflow-x: hidden` global enmascara cualquier desbordamiento y hace que la comprobación exigida no pueda fallar de forma visible; (2) medio, reordenar ejercicios pierde el foco y no anuncia el nuevo orden; (3) medio, el temporizador de descanso se cancela en silencio al salir de la tarjeta; (4) bajo, `--ink-3` sobre `--paper` cumple AA con poco margen.
- Resultado para Opus: requiere corrección.

### 9 — Revisor de seguridad de ejercicio y alcance (independiente)

- Rol: revisor de seguridad · Sonnet · medio · solo lectura
- Archivos modificados: ninguno.
- Verificación ejecutada y resultado: ninguna frase diagnostica, nombra patología, sugiere tratamiento ni atribuye causa. Aviso de no diagnóstico presente al declarar molestia, en la propuesta de adaptación y en el cierre de la sesión de fuerza. Sin inferencia: la única regla por zona actúa solo sobre la zona marcada por la persona. Recuperación y sesiones adaptadas, parciales u omitidas nunca enmarcadas como fracaso. Progresión con aviso explícito de validación profesional pendiente y nunca presentada como prescripción. Sin `fetch`, `XMLHttpRequest`, `WebSocket`, `iframe`, `eval` ni `new Function`; `innerHTML` solo con literales estáticos, sin vector de inyección desde texto de la persona; sin credenciales reales en `localStorage`. Consentimiento, borrado de cuenta y revocación del enlace explicados y etiquetados como simulados.
- Hallazgos no bloqueantes: la molestia y el comentario declarados al cerrar una sesión de fuerza se recibían y se perdían sin persistirse; y el aviso de progresión vive solo en la ficha de catálogo.
- Resultado para Opus: completado.

### 10 — Implementador del lote de corrección

- Rol: implementador · Sonnet · medio
- Archivos modificados: `js/views/strength.js`, `js/views/history.js`, `js/data.js`, `styles.css`, `README.md`.
- Resumen de trabajo: C1, foco devuelto al botón de reordenar y región `aria-live` que anuncia la nueva posición; C2, confirmación al salir solo si hay descanso en curso; C3, objetivos táctiles de la píldora de sincronización y de las pestañas; C4, molestia y comentario persistidos en el historial y mostrados en el detalle con el mismo aviso literal de `checkin.js`; C5, `README.md` reescrito para declarar el método de medición del desbordamiento, marcar las piezas con evidencia de rondas anteriores y añadir el límite del deshacer.
- Resultado para Opus: completado.

### 11 — Opus, corrección directa C3b

- Rol: orquestador actuando como implementador de un cambio de dos líneas
- Archivos modificados: `styles.css`.
- Motivo: tras verificar el lote de corrección quedaban tres controles por debajo de 44 px que no estaban en el encargo original (`.modeswitch__btn` a 38 px de alto y `.picker__btn` a 42 px de ancho con etiquetas muy cortas). Delegar dos declaraciones CSS no era proporcionado; queda registrado aquí para no ocultar que Opus escribió código.
- Verificación: medición posterior en navegador, ningún control por debajo de 44 px en las trece vistas.

## 3. Validación de Opus

Verificación propia, en navegador real (Chromium), a 375x812 y 1440x900, sirviendo `prototype/` por HTTP local porque la herramienta de automatización bloquea el protocolo `file:`.

- Desbordamiento horizontal, medido **neutralizando** `overflow-x: hidden` con una regla inyectada, para que la comprobación pudiera fallar: `scrollWidth == clientWidth` en las trece vistas a 375x812 y a 1440x900, y cero elementos con borde fuera del ancho del documento. El hallazgo 1 del revisor de UX era correcto como crítica de método y quedó desmentido como defecto: no hay desbordamiento real.
- Objetivos táctiles: tras C3 y C3b, ningún control interactivo por debajo de 44x44 px en las trece vistas.
- Consola: sin ningún error propio del prototipo en todo el recorrido. Los únicos mensajes son dos 404 de `favicon.ico`, generados por el servidor local de verificación y ausentes al abrir el archivo directamente.
- Hoja modal: `role="dialog"`, `aria-modal="true"`, foco inicial dentro del panel, Escape cierra y el foco vuelve al disparador.
- Pestañas: `aria-selected` y tabindex roving conmutan con flecha derecha y el foco sigue a la pestaña activa.
- Invariante de recolocación: 6 sesiones y 291 minutos antes, durante y después; `day` pasa de `jue` a `sab` con `movedFrom = jue`, y deshacer restaura `jue` y borra `movedFrom`. Ninguna duplicación.
- Adherencia: 6 completadas más 2 adaptadas igual a 8; 2 parciales y 1 omitida no suman.
- C1 verificado: tras reordenar, el foco queda en el botón del ejercicio movido y la región `aria-live` anuncia "Jalón al pecho ahora en la posición 2 de 5.".
- C2 verificado: con el descanso corriendo a 1:29, salir pide confirmación con el texto acordado; cancelar mantiene la tarjeta y el reloj sigue corriendo a 1:28. Sin descanso en curso no aparece ninguna hoja. Confirmado además que el temporizador nunca arranca solo: requiere pulsar "Iniciar".
- C4 verificado de extremo a extremo: cerrar con molestia "Importante" persiste `molestia` y `comentario`, y el detalle del historial muestra la intensidad declarada, el comentario y el aviso de bienestar general con el texto literal de `checkin.js`, sin lenguaje médico. Las entradas antiguas sin molestia no muestran nada inventado.
- Prioridad de Inicio conforme a la nota 28: la sesión del día es lo primero, después las opciones y después la semana.

Decisión: plan completo. Motivo: las 29 piezas existen como flujos navegables con efecto verificable, los tres revisores independientes emitieron resultado, el único revisor que pidió corrección vio atendidos sus tres hallazgos accionables, y el cuarto se documentó como límite conocido.

## 4. Estado final

- Resultado entregado: prototipo navegable completo en `prototype/` (cascarón, sistema visual, núcleo, datos simulados y trece vistas registradas), `README.md` con la tabla de cobertura de 29 filas y el método de medición declarado, y esta traza.
- Límites o comportamientos simulados pendientes: sin backend, red, autenticación real ni Service Worker; el análisis de FIT/TCX/GPX/CSV está simulado; el enlace compartido no sale del dispositivo; `localStorage` etiquetado como simulación con reinicio visible; deshacer es un único slot global, no una pila; el recorrido con doble clic sobre `file://` no pudo ejecutarse porque la herramienta de automatización bloquea ese protocolo, y solo está respaldado por prueba de código (sin módulos ES, sin `fetch`, sin imports, rutas relativas); el contraste en tema claro se verificó parcialmente; `MVP-DEFINITION.md` §6 quedó desactualizado respecto de la nota 28 y debería corregirse en una tarea aparte.
- Aprobación humana: pendiente. Se solicita ahora, una vez completadas las verificaciones exigidas.
- Autorizaciones externas otorgadas: ninguna. No se ha hecho commit, push, despliegue ni publicación.
