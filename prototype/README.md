# Prototipo navegable — Entrenador híbrido "Tu camino"

Prototipo de alta fidelidad en HTML, CSS y JavaScript nativos. Sin dependencias, sin backend, sin proceso de compilación, sin `fetch` y sin recursos remotos (salvo enlaces externos a YouTube, que abren en pestaña nueva). Todos los datos son ficticios y viven en `App.data`; una copia se guarda en `localStorage` bajo la clave `trainer-demo-v3`, marcada como simulación, para poder recuperar el estado local entre recargas. El botón "Reiniciar demo" borra ese almacenamiento y vuelve al estado inicial.

## Cómo abrirlo

**Opción A — doble clic (sin servidor):**
Abre `prototype/index.html` en un navegador (protocolo `file://`). Funciona porque no hay módulos ES, ni `fetch`, ni imports: todos los `<script>` son clásicos.

**Opción B — servidor estático:**
```
cd prototype
python -m http.server 8080
```
Y visita `http://localhost:8080`.

Referencia visual primaria: iPhone (~375 px). Revisado también a 1440 px.

## Mapa de archivos

- `index.html` — cascarón único: cabecera, `#mainContent` (lo rellenan las vistas), navegación inferior, host de hojas modales y los `<script>` de carga.
- `styles.css` — sistema visual completo, organizado por secciones comentadas; cada lote añade su propia sección al final sin tocar las anteriores.
- `js/data.js` — todo el dataset ficticio (`App.dataDefaults()`) y los helpers de dominio (`App.data.*`) que mutan ese estado; sin lógica de UI.
- `js/core.js` — router (`App.navigate`), hojas modales (`App.openSheet`/`App.confirmSheet`), estados transversales (`App.states`), sincronización simulada (`App.sync`), persistencia local y arranque de la app.
- `js/views/access.js` — acceso, alta, recuperación de contraseña, consentimiento inicial y perfil de onboarding.
- `js/views/home.js` — "Tu camino": sesión protagonista, progreso del bloque, carril semanal, cifras, evolución, actividad reciente y un logro.
- `js/views/plan.js` — calendario semanal, fases y gestión del ciclo de vida de los planes.
- `js/views/plan-builder.js` — creador guiado de plan (plantilla o desde cero).
- `js/views/checkin.js` — check-in, molestias y mapa corporal.
- `js/views/recovery.js` — sesión de recuperación (movilidad/cardio suave/descanso).
- `js/views/strength.js` — sesión de fuerza: lista, tarjeta de ejercicio, series, temporizador, excepciones y cierre.
- `js/views/library.js` — catálogo, ficha/guía, variantes, ejercicio propio y referencia de carga y progresión.
- `js/views/endurance.js` — sesión de resistencia planificada y ejecución por segmentos.
- `js/views/import.js` — importación manual simulada de actividad (FIT/TCX/GPX/CSV).
- `js/views/history.js` — historial, filtros, corrección versionada, adherencia, logros y métricas personales opcionales.
- `js/views/profile.js` — perfil, preferencias, seguridad, datos y privacidad, plataforma (PWA) y panel de demo.
- `js/views/share.js` — compartir rutina, enlace simulado, vista previa y copia independiente.

## Tabla de cobertura de las 29 piezas del encargo

Recorrida en navegador real (Chromium vía Playwright, sirviendo `prototype/` con `python -m http.server`), 375×812 y 1440×900, con clics reales y algunas comprobaciones de estado con `App.data`/`App.viewContext` tras cada acción para verificar el efecto exacto. Las piezas 25 a 29 (propiedad de este lote) se verificaron con el mayor detalle: cada botón, cada validación y cada número. Las piezas 1 a 24 (entregadas en lotes anteriores) se recorrieron con clics reales en los flujos troncales de esta ronda y con navegación puntual a cada vista para confirmar que seguían respondiendo tras los cambios de este lote; no se repitió la batería exhaustiva de cada una.

**Corrección C5b (honestidad de la evidencia):** la fila "Estado" de cada pieza distingue ahora si el clic que la respalda es de esta ronda o de una ronda anterior no repetida en este cierre, en vez de presentarlas todas con el mismo "Cubierto". Las filas marcadas "Cubierto con límite" se apoyan en recorridos de rondas anteriores (lotes 2 a 5, o el cierre del lote 6 antes de este lote de corrección); no se relanzó su batería de clics en esta pasada porque su código no cambió, salvo donde se indica lo contrario (p. ej. la fila 17, cuyo reordenar y cierre parcial sí se repitieron aquí como parte de la verificación de C1/C2).

| # | Pieza | Ruta de prueba | Resultado | Estado |
| - | ----- | --------------- | --------- | ------ |
| 1 | Arquitectura y casos de uso | Iniciar sesión → observar navegación inferior (Inicio/Plan/Entrenar/Ejercicios/Historial) → tocar cada botón | Las 5 áreas principales se alcanzan sin recarga desde la barra inferior; Perfil y Compartir se alcanzan desde los enlaces de "Tu camino" | Cubierto con límite (C5b): evidencia de clic de una ronda anterior; esta ronda solo se recorrió indirectamente vía Entrenar/Historial, sin repetir el recorrido completo de las 5 áreas |
| 2 | Cuenta y onboarding | Acceso → `demo@trainer.app` / `demo1234` incorrecto → error; credenciales correctas → privacidad → perfil inicial (5 pasos) → Tu camino | Error de credenciales visible, consentimiento explicado y perfil guiado sin RPE ni inventario de máquinas | Cubierto |
| 3 | Plan y calendario | Plan → pestaña Semana → Editar/Omitir/Recolocar una sesión | Cambios reflejados de inmediato en el carril y en las cifras de la semana | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 4 | Navegación y estados de entrada | Cerrar sesión conservando datos → vuelve a "Inicia sesión"; recargar con sesión en curso → Entrenar la recupera | Estados de entrada (primer uso, sin plan, con plan, retomar sesión) alcanzables | Cubierto con límite (C5b): "cerrar sesión conservando datos" se repitió esta ronda (ver Perfil, fila 5); "recargar con sesión en curso" es evidencia de una ronda anterior, no repetida en este cierre |
| 5 | Cuenta, datos y privacidad | Perfil → Seguridad → Cambiar contraseña con datos inválidos (actual incorrecta, nueva de 3 caracteres, confirmación distinta) → 3 errores de campo; corregidos → contraseña actualizada. Datos y privacidad → ver detalle → aceptar consentimiento. Cuenta → cerrar sesión (elegir conservar/borrar datos) → solicitar borrado (bloqueado sin casilla, luego confirmado) → estado "Solicitud de borrado registrada el Hoy" visible | Validación por campo con `aria-invalid`/`aria-describedby`/`role="alert"`; consentimiento persistido; cierre de sesión con elección real de conservar/borrar; solicitud de borrado con confirmación inequívoca y estado posterior visible, no instantáneo | Cubierto |
| 6 | Tu camino | Home tras login | Orden: sesión protagonista → opciones → progreso de bloque/semana → cifras → evolución → actividad reciente → un logro (alcanzado o cercano) | Cubierto |
| 7 | Creador guiado | Plan → Tus planes → Crear plan → elegir plantilla PPL → objetivo/experiencia/disponibilidad/duración/entorno/cardio → semana propuesta | Genera una semana y una línea de fases editable antes de activar | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 8 | Ciclo de vida del plan y fases | Plan → Tus planes: ver plan borrador, activo y archivado; Fases: línea temporal con estado completada/actual/pendiente | Los 6 estados (borrador/activo/pausado/finalizado/archivado + duplicado) y la línea de fases son navegables | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 9 | Ciclo de vida del calendario | Plan → Semana → Recolocar Legs de viernes a jueves → confirmar; Deshacer recolocación | Recolocar mueve `day` sin duplicar la sesión; deshacer restaura el día y estado previos | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 10 | Estado de sesión coherente | Plan (Legs: Planificada) → Entrenar → cerrar parcial → Plan e Historial muestran "Parcial" en ambos sitios | El mismo estado se refleja en plan, carril, inicio e historial sin contradicción | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 11 | Check-in | Home → "Ajustar a cómo llego hoy" → energía baja + 40 min → Revisar propuesta | Propuesta explicada ("el descanso recomendado sube 15 s") con motivo declarado, no cambio silencioso | Cubierto |
| 12 | Molestias y mapa corporal | Check-in → declarar molestia leve → mapa corporal aparece | Mapa oculto hasta declarar molestia; zona/lado/intensidad/tipo seleccionables | Cubierto con límite: no se repitió esta ronda el conteo exhaustivo de las 18 zonas ni el aviso de molestia importante, ya verificados en el lote 3 |
| 13 | Recuperación | Home → "Cambiar a recuperación" → movilidad/cardio suave/descanso → cerrar | Registra sin presentarlo como fracaso; cuenta como adherencia cuando sustituye la sesión de hoy | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 14 | Lista y tarjeta de ejercicio | Entrenar → Pull → tarjeta de "Jalón al pecho" | Objetivo, último resultado, series, progreso y cierre visibles en la tarjeta | Cubierto |
| 15 | Dos modos de registro | Tarjeta de ejercicio → alternar "Serie a serie" / "Editar todas" | Ambos modos disponibles y funcionales | Cubierto con límite: se verificó "serie a serie" con clic real esta ronda; "editar todas" se confirmó por inspección y navegación, no con clic completo de guardado |
| 16 | Temporizador de descanso | Confirmar una serie → temporizador aparece | Iniciado solo por la persona, editable, discreto al terminar | Cubierto con límite: no se repitió el cronometraje en segundos de este lote (verificado en el lote 3) |
| 17 | Excepciones reales | Tarjeta de ejercicio → Omitir / Cambiar variante / Añadir ejercicio | Las 4 excepciones (variante, omitir, añadir, reordenar) están disponibles | Cubierto con límite (C5b): reordenar y el cierre parcial se verificaron de extremo a extremo en el lote de corrección (ver C1/C2 en "Verificación ejecutada"); omitir, cambiar variante y añadir son evidencia de una ronda anterior, no repetida en este cierre |
| 18 | Ficha de ejercicio | Ejercicios → "Ver ficha y guía" en "Jalón en polea" | Miniatura SVG bajo demanda, patrón, guía técnica, músculos, vídeo externo con `target="_blank" rel="noopener"` | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 19 | Catálogo | Ejercicios → buscar/filtrar por patrón, grupo, equipo, favoritas | 33 ejercicios, favoritas marcadas con texto y símbolo, vacío útil con "Quitar filtros", ejercicio propio creable/editable/eliminable | Cubierto con límite (C5b): evidencia de clic de una ronda anterior, no repetida en el cierre de este lote |
| 20 | Referencia de carga y progresión | Ficha de ejercicio → bloque "Referencia de carga" | Última ejecución, sugerencia editable, registro de resultado real y próxima referencia por variante, con aviso de que la regla es orientativa | Cubierto con límite: no se repitió el registro de un resultado nuevo esta ronda (verificado en el lote 4) |
| 21 | Sesión de resistencia planificada | Plan → Intervalos → Entrenar | Objetivo con duración, intensidad, estructura y propósito explicados | Cubierto con límite: se navegó a la sesión pero no se recorrieron los 6 objetivos completos esta ronda |
| 22 | Ejecución por segmentos | Entrenar (resistencia con tramos) → marcar tramo, ajustar, pausar | Calentamiento/trabajo/recuperación con pausa, ajuste y guardado adaptado/parcial | Cubierto con límite: no recorrido con clic esta ronda; confirmado por inspección de código y por su uso indirecto en la nota de contexto de carga |
| 23 | Importación manual simulada | Importar → elegir `actividad_jueves.fit` (válido) → análisis breve → editar asociación → guardar | Análisis con tipo/duración/distancia/ritmo/FC/carga estimada; también existen los caminos no admitido, inválido y duplicado (verificados en el lote 5, no repetidos esta ronda) | Cubierto |
| 24 | Contexto de carga | Tras guardar la importación → "Volver a inicio"; `App.data.loadContext()` | Mensaje explicable ("carga estimada media… no hemos cambiado tu plan por esto") sin alterar el calendario de `Plan` | Cubierto |
| 25 | Historial y progreso | Historial → filtros de periodo/tipo/estado → detalle de "Legs" → Corregir registro (motivo vacío bloquea; con motivo, guarda) | 11→2 registros al filtrar "Esta semana"; filtro persiste al salir y volver; corrección crea versión nueva SIN borrar la anterior (verificado leyendo `App.data.HISTORY` antes/después) | Cubierto |
| 26 | Adherencia y logros | Historial → pestaña "Adherencia y logros" | Completadas 6, adaptadas 2, recuperación válida 2 (subconjunto de las anteriores), parciales 2 y omitidas 1 — parciales/omitidas NO suman a "8 suman adherencia"; un logro alcanzado y uno cercano, sin calorías/peso ni rankings | Cubierto |
| 27 | Métricas personales opcionales | Historial → Métricas → Registrar con valor vacío/fecha vacía → 2 errores de campo; corregidos → guardado; Corregir un valor existente → versión con motivo | Validación por campo (`role="alert"`), tendencia "-1.5 kg… informativa y privada, no un objetivo", corrección versionada sin borrar el valor anterior, aviso de que no condiciona las recomendaciones | Cubierto |
| 28 | Compartir rutina | Compartir → generar enlace → vista previa → crear copia → adaptar copia (Jalón en polea 52.5→57.5 kg) → adaptar original (→55 kg) → revocar enlace | Copia con calendario/cargas propios; adaptar la copia NO cambió el original (55 vs 57.5 kg) y viceversa, comprobado en ambas direcciones; revocar impidió nuevas copias pero la copia ya creada siguió existiendo | Cubierto |
| 29 | PWA/offline, procedencia y accesibilidad | Perfil → Instalar → Actualizar; Panel de demo → recorrer los 5 estados de sincronización incluida resolución de conflicto; con sync en "error", confirmar una serie y cerrar una sesión parcial con éxito | Instalación y actualización simuladas con estado "Instalada" visible; los 5 estados (local/sincronizando/sincronizado/conflicto/error) alcanzables, con resolución "conservar local/servidor"; el registro de series y el cierre de sesión NUNCA se bloquearon con sync en error; procedencia con texto ("Local"/"Importado"/"Adaptado por ti") además de color en todo el historial | Cubierto |

**Resumen de cobertura:** 29 de 29 piezas cubiertas; 17 de ellas ("cubierto con límite", corrección C5b) con una verificación más ligera en esta ronda porque pertenecen a lotes anteriores y no cambiaron de código en este lote — su comportamiento se confirmó por navegación real en una ronda anterior, pero no se repitió la batería completa de clics en el cierre de este lote. Ninguna pieza quedó sin cubrir.

## Datos ficticios incluidos

- Plan activo "Bloque de hipertrofia", semana 3 de 8, con Push completado el lunes, carrera suave el martes, Pull previsto hoy (miércoles), Intervalos el jueves, Legs el viernes y carrera larga el domingo; además un plan en borrador ("Full body para viajar") y uno archivado ("Base de fuerza").
- Sesión Pull con jalón al pecho, remo sentado, face pull, pullover en polea y curl de bíceps, cada uno con objetivo y último resultado; catálogo completo de 33 ejercicios con 3 favoritas de partida.
- **Historial de 11 sesiones** (fuerza, cardio y recuperación) repartidas en 4 semanas, con procedencia, sincronización y detalle por tipo; una de ellas ("Legs", semana pasada) trae ya una versión corregida de ejemplo, con motivo, para poder consultar la corrección sin tener que generarla primero.
- **Métricas personales**: dos registros de peso (con tendencia calculable) y una medida de cintura; el primer registro de peso trae ya una corrección versionada de ejemplo.
- **Compartir**: un enlace simulado activo (`trainer-demo://compartir/DEMO-0001`) con su alcance (estructura, notas, ejercicios) listo para generar copias.
- **Logros**: uno alcanzado ("Completaste tu primera semana completa") y uno cercano ("A una sesión de tu racha de 3 semanas seguidas").
- **Plataforma**: estado inicial "no instalada" con actualización pendiente, para poder recorrer el flujo de instalación y actualización desde cero.
- Importación: un archivo FIT válido, un GPX válido sin FC, un formato no admitido (.PWX), un FIT inválido demasiado pequeño y un FIT que coincide con una actividad ya registrada (posible duplicado).

## Comportamientos simulados (no reales)

- **Sincronización y offline**: no hay red real, cola de cambios ni servidor. El estado (local/sincronizando/sincronizado/conflicto/error) se cambia a mano desde el panel de demo o la píldora de la cabecera; nunca bloquea registrar una serie ni cerrar una sesión.
- **Instalación y actualización de la PWA**: sin Service Worker real ni manifiesto funcional. "Instalar", "Actualizar ahora" y sus estados son banderas en memoria (`App.data.PWA`).
- **Importación de actividad**: sin parser real de FIT/TCX/GPX/CSV; elegir un archivo de una lista ficticia simula el resultado del análisis.
- **Autenticación**: sin backend ni base de datos. Solo `demo@trainer.app` / `demo1234` "inicia sesión" con éxito; cualquier otra combinación simula un error de credenciales. El cambio de contraseña compara contra un valor guardado en memoria (`App.data.user.password`), no contra la constante de acceso.
- **Recuperación de contraseña y borrado de cuenta**: no se envía ningún correo ni se borra ningún dato real; ambos solo cambian el estado visible en memoria.
- **Compartir y copia**: el "enlace" es una cadena de texto (`trainer-demo://compartir/…`), no una URL real ni una llamada de red. La copia independiente es un objeto separado y autocontenido (`App.data.ROUTINE_COPIES`), no una integración con el motor real de planes/calendario de otros lotes: existe para demostrar la independencia de cargas y calendario, no para sustituir el modelo de datos de un plan real.
- **Motor de adaptación y de progresión**: reglas condicionales simples y conservadoras, explícitamente pendientes de validación profesional antes de producción; no son el motor determinista descrito en `MVP-DEFINITION.md`.
- **Deshacer (límite conocido, C5c)**: `App.data.lastAction` es un único slot global de deshacer (una sola acción reciente), no una pila. Cubre el flujo real del prototipo (recolocar u omitir una sesión → deshacer inmediato); una decisión posterior sobre la misma sesión invalida el deshacer pendiente. Si hiciera falta deshacer acciones antiguas tras otras decisiones, haría falta pasar a una pila de acciones por sesión — no implementado en este prototipo.
- **Minutos de sesión**: estimados de forma proporcional a las series/tramos realmente registrados sobre una duración de referencia, nunca un tiempo medido de verdad.
- **Vídeo técnico**: enlaza a una búsqueda de YouTube; no hay reproductor embebido ni `<iframe>`.
- Todos los cambios viven en memoria y en `localStorage` local; "Reiniciar demo" los borra y vuelve al estado inicial.

## Accesibilidad y movimiento

- Filtros de historial y selectores rápidos con `aria-pressed="true|false"` en todos los botones de conmutación.
- Pestañas (Plan, Historial) con `role="tab"`, `aria-selected`, panel asociado (`aria-controls`) y navegación con flechas / Inicio / Fin con *roving tabindex*: verificado con `ArrowRight` en las pestañas de Historial (foco y `aria-selected` se mueven juntos, `tabIndex` pasa a `-1` en la pestaña no seleccionada).
- Hojas modales: foco inicial en el primer control del cuerpo, `Escape` cierra y devuelve el foco al disparador — verificado con clic real en "Cerrar sesión" → `Escape` → foco de vuelta en el botón "Cerrar sesión".
- Errores de formulario (cambio de contraseña, registrar/corregir métrica, corregir un registro de historial) asociados a su campo con `aria-invalid`, `aria-describedby` y `role="alert"`, con foco en el primer campo inválido.
- El color nunca es la única señal: procedencia y sincronización siempre llevan texto (por ejemplo "✓ Sincronizado", "Adaptado por ti"), no solo un color o icono.
- Objetivos táctiles ≥44 px reutilizados del sistema existente (`.btn`, `.picker__btn`, `.chip`).
- `prefers-reduced-motion` y ausencia de `transition: all`/`ease-in` heredados del sistema de estilos existente; este lote no añade animaciones nuevas.

## Verificación realizada

Navegador real (Chromium vía Playwright), sirviendo `prototype/` con `python -m http.server 8099`, viewports 375×812 y 1440×900. El servidor se detuvo al terminar. El 404 de `favicon.ico` no cuenta como hallazgo.

- `node --check` sin errores en `data.js`, `core.js` y los 15 archivos de `js/views/`.
- **Filtros de historial**: 11 registros sin filtro (12 tras registrar una sesión nueva en vivo); "Esta semana" → 2 de 11 (o 12); filtro conservado al navegar a Inicio y volver a Historial.
- **Corrección versionada (historial)**: corregido "Legs" en vivo → `versions.length` pasó de 1 a 2; el registro vigente no perdió datos; la versión anterior original (con su motivo "Se me olvidó anotar la prensa…") siguió consultable.
- **Adherencia**: completadas 6, adaptadas 2, recuperación válida 2, parciales 2, omitidas 1, total adherencia 8 = completadas + adaptadas exactamente; confirmado que parciales y omitidas no se suman.
- **Métricas**: valor vacío + fecha vacía → 2 mensajes de error asociados a sus campos ("Escribe un valor numérico mayor que 0." / "Elige una fecha."); valor válido (76.9 kg) → guardado y tendencia recalculada a "-1.5 kg…"; corrección a 76.5 kg → versión anterior (76.9 kg, motivo "Báscula recalibrada.") consultable.
- **Compartir**: enlace generado, vista previa mostrada, copia creada con cargas propias (52.5 kg); copia adaptada a 57.5 kg mientras el original seguía en 52.5 kg; original adaptado después a 55 kg mientras la copia seguía en 57.5 kg (independencia confirmada en ambas direcciones); enlace revocado (`estado: "revocado"`) con la copia existente intacta (`ROUTINE_COPIES.length` sin cambios).
- **Perfil**: cambio de contraseña con datos inválidos → 3 errores de campo simultáneos; con datos válidos → contraseña actualizada; consentimiento actualizado y persistido; cierre de sesión con elección real de conservar datos (`HISTORY.length` se mantuvo tras cerrar sesión); solicitud de borrado bloqueada sin la casilla de confirmación, luego registrada con estado visible "Solicitud de borrado registrada el Hoy".
- **Offline/sincronización**: con el estado forzado a "Error recuperable", se confirmó una serie real (`sets[0].estado` pasó a `"hecha"`) y se cerró una sesión como parcial (`HISTORY` pasó de 11 a 12 registros) sin ningún bloqueo; los 5 estados alcanzados desde el panel de demo, incluida la resolución de conflicto ("Conservar versión local/servidor") desde la píldora de la cabecera.
- **Instalación y actualización**: "Instalar" → `App.data.PWA.instalada === true`; "Actualizar ahora" → `updateDisponible === false`; el panel de demo puede volver a mostrar ambos avisos para repetir el recorrido.
- **Reinicio de la demo**: tras reiniciar, `HISTORY.length` volvió a 11, `PWA` volvió a su estado inicial, la solicitud de borrado se limpió y la vista volvió a "Inicia sesión".
- **Recorrido 1 (encargo)**: acceso → Tu camino → check-in (energía baja, 40 min) → propuesta adaptada aplicada → sesión de fuerza Pull (versión adaptada) → cierre completo con esfuerzo "Adecuado" → Historial muestra la sesión como "Adaptada" con el detalle de los 5 ejercicios y sus cargas reales.
- **Recorrido 2 (encargo)**: importar `actividad_jueves.fit` (válido) → análisis breve → guardar sin asociar sesión → mensaje de contexto de carga ("carga estimada media… no hemos cambiado tu plan por esto") → Plan sigue mostrando el mismo calendario de 6 sesiones, sin alteración automática.
- **Un bug real encontrado y corregido durante esta verificación**: `App.states.error()` limpia por completo el contenedor que recibe; al pasarle la sección que ya contenía el `<h1>` de Historial, el título desaparecía en el estado de error forzado. Corregido dibujando el error en un `<div>` aparte, igual que el patrón ya usado en `import.js`/`endurance.js`. Verificado tras la corrección: el `<h1>` "Historial" permanece visible con el error mostrado debajo, y "Reintentar" recupera el contenido normal.
- **Otro bug real encontrado y corregido**: cambiar de pestaña en Historial llamaba a `render(mount)` sin limpiar `mount` primero (a diferencia de `plan.js`, que sí lo hace), lo que apilaba el contenido de la vista en vez de sustituirlo tras dos cambios de pestaña. Corregido añadiendo `mount.innerHTML = ""` al inicio de `render()`. Verificado tras la corrección: un único `<h1>` en `#mainContent` y `aria-selected`/`tabIndex` correctos tras `ArrowRight`.
- **Overflow (corrección C5a — método explícito, no solo la conclusión)**: la afirmación anterior de "sin desbordamiento horizontal" era inverificable tal cual, porque `styles.css` fuerza `overflow-x: hidden` en `html, body`, lo que oculta visualmente cualquier desbordamiento real (`scrollWidth` seguiría creciendo, pero no se ve ni se puede clicar). Medición corregida: se inyectó una regla que neutraliza ese `overflow-x` (`html, body { overflow-x: visible !important }`) y, con ella activa, se comparó `document.body.scrollWidth` contra `document.body.clientWidth` en las 13 vistas del prototipo, a 375×812 y a 1440×900 — 26 comprobaciones en total. Resultado: `scrollWidth === clientWidth` en las 26, 0 desbordamientos reales.
- **Enlaces externos y `<iframe>`**: `grep` sobre todo `prototype/` confirma 0 etiquetas `<iframe>` y que los 2 únicos `href` a contenido externo (vídeo de YouTube en `strength.js` y `library.js`) llevan `target="_blank"` y `rel="noopener"`.
- **Consola**: sin errores propios en ningún momento del recorrido (solo el 404 esperado de `favicon.ico` al servir por HTTP, y un error de un script de verificación propio que consultó el DOM antes de tiempo, no del prototipo).

### Lote de corrección (C1–C5): verificación específica

Navegador real (Chromium vía Playwright), sirviendo `prototype/` desde `http://127.0.0.1:8777/index.html`, 375×812 y 1440×900.

- **C1 (reordenar sin perder el foco)**: en Entrenar → Pull, se pulsó "↓ Bajar" en "Remo sentado" — el foco quedó en su propio botón "↑ Subir" (ahora en la posición 2) y la región `aria-live="polite"` anunció "Remo sentado ahora en la posición 2 de 5."; al subirlo hasta el tope (botón "↑ Subir" resultante deshabilitado), el foco cayó de forma correcta en el "↓ Bajar" de ese mismo ejercicio en vez de perderse.
- **C2 (confirmación antes de cancelar el descanso)**: se confirmó una serie, se inició el temporizador de descanso y se pulsó "←" — apareció la hoja de confirmación con el texto exacto "Al salir se detiene el descanso en curso. ¿Salir de todas formas?"; "Cancelar" mantuvo el temporizador corriendo y la tarjeta abierta; "Salir" lo detuvo y volvió a la lista. Repetido sin descanso en curso: "←" navega directo, sin ninguna hoja.
- **C3 (objetivos táctiles ≥44px)**: medidos con `getBoundingClientRect()` tras recargar `styles.css` — pestaña "Fases" en Plan pasó de 34×46 a 44×46; píldora de sincronización de la topbar pasó de 140×34 a 140×44. Sin desbordamiento tras el cambio (ver overflow más abajo).
- **C4 (molestia y comentario del cierre, persistidos y mostrados)**: se completaron las 15 series de "Pull", se cerró con esfuerzo "Adecuado", molestia "Importante" y un comentario; `App.data.HISTORY[0].molestia === "Importante"` y `.comentario` con el texto exacto tras guardar. En el detalle del historial aparece "Molestia declarada al cerrar: Importante" junto al mismo aviso literal de `checkin.js` ("Molestia importante: esto no es un diagnóstico…") y el comentario debajo. Verificado también que una entrada antigua del dataset semilla (sin `molestia` declarada) NO muestra el bloque — nunca se inventa un "Ninguna" para lo que la persona no declaró.
- **Consola**: 0 mensajes de error o warning durante todo este recorrido (login, onboarding, reordenar, temporizador, cierre con molestia, historial).
- **Overflow tras los cambios de C1–C4**: con `styles.css` recargado, `document.body.scrollWidth === document.body.clientWidth` en Tu camino, Plan, Historial y Entrenar/Pull a 375×812 y en las mismas cuatro a 1440×900 — 8 comprobaciones, 0 desbordamientos.

**Sin verificar en esta ronda:**

- **`file://` real**: la herramienta de automatización usada bloquea la navegación a `file://` por política de seguridad del entorno, así que no se pudo confirmar con clics reales. Se verificó por inspección de código que no hay `<script type="module">`, `import` ni `fetch`/`XHR` en ningún archivo del prototipo (incluidos los tres nuevos de este lote), condición suficiente conocida para que `file://` funcione, pero no es lo mismo que haberlo abierto y clicado.
- Navegadores reales distintos de Chromium (Safari, Firefox, WebKit en iOS).
- Lectores de pantalla reales (NVDA, VoiceOver, TalkBack); la verificación de accesibilidad se apoyó en el árbol de accesibilidad de Playwright (`aria-*`, roles, nombres accesibles) y en comprobaciones puntuales de foco, no en una escucha real.
- Recorrido completo por teclado (sin ratón) de absolutamente todas las vistas; se verificó Escape/foco en una hoja y flechas en las pestañas de Historial, no cada control de cada pantalla.
- Las piezas 12, 15, 16, 20, 21, 22 y 23 se navegaron esta ronda pero no se repitió su batería de verificación completa (ver notas en la tabla de cobertura), porque pertenecen a lotes anteriores y no se modificó su código en este lote.
- Contraste WCAG AA no se recalculó en esta ronda para las vistas nuevas (Historial, Perfil, Compartir); reutilizan los mismos tokens de color (`--ink`, `--accent`, `--warn`, etc.) ya verificados en lotes anteriores para el resto del sistema, pero no se repitió la medición de luminancia pieza por pieza.

Además de lo anterior, la herramienta de test generó `d:\Trainer\.playwright-mcp\` (capturas de página y logs de consola de esta sesión); no se ha forzado su borrado.
