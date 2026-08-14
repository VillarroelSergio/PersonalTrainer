# Onboarding, propuesta editable y catálogo compatible

## Objetivo

Corregir el flujo de creación de planes para que cada modo solo muestre las
decisiones que necesita, y permitir que la persona vea y edite los ejercicios
antes de activar el plan. La misma entrega amplía el catálogo editorial de
ejercicios, equipamiento compatible y rutinas sin introducir un inventario por
marca ni nuevas tablas de datos.

## Alcance aprobado

### Modo guiado

- El paso de selección de rutina no se muestra en modo `guided`.
- El progreso se calcula con 13 pasos visibles y los botones Atrás/Continuar
  saltan correctamente el paso omitido.
- La propuesta guiada se genera directamente a partir de las respuestas.

### Rutina personalizada

- Las rutinas se muestran como tarjetas radio controladas.
- La tarjeta seleccionada tiene estado visible, `aria-checked` y un indicador
  no dependiente solo del color.
- Las rutinas incompatibles explican qué capacidad de equipamiento falta.
- Cada tarjeta permite consultar el resumen de sesiones y ejercicios antes de
  continuar.

### Edición de propuesta

- “Editar sesiones” mantiene día y duración editables, pero no permite cambiar
  el nombre editorial de la sesión.
- Cada sesión de fuerza expone ejercicios, series y repeticiones.
- Cada ejercicio puede sustituirse por una variante activa del mismo patrón de
  movimiento y compatible con el entorno/equipamiento declarado.
- La sustitución conserva series y rango de repeticiones.
- La propuesta editada es la que se activa; no se modifica el catálogo.

### Ampliación editorial

- Mantener los identificadores existentes y ampliar el catálogo hasta al menos
  45 variantes activas con barra, mancuernas, poleas, máquinas y peso corporal.
- Publicar siete plantillas versionadas de gimnasio completo: tres de 3 días,
  dos de 4 días y dos de 5 días.
- Reutilizar las categorías actuales de equipamiento como capacidades de
  compatibilidad.
- Resolver cada patrón con una variante disponible; si falta una variante, la
  plantilla no se ofrece como compatible.
- Mantener medios opcionales y solo con recursos editoriales existentes o
  licencias verificables; no inventar URLs.

## Arquitectura y flujo de datos

El estado del wizard obtiene una lista de pasos visible según el modo, sin
cambiar el contrato persistido del borrador. `PlanProposal.week.sessions` ya
transporta `variantId`, objetivos de series y repeticiones, por lo que el editor
resuelve nombres y alternativas desde el catálogo editorial y devuelve una
copia local de la propuesta. La activación usa esa copia; no requiere migración
de base de datos.

Las alternativas se calculan con una función pura que recibe el `variantId`
actual y el perfil de entorno. Filtra por `movementPattern`, `active`, entorno y
requisitos satisfechos, y excluye la variante actual cuando exista otra opción.

## Estados de interfaz

- Carga: la propuesta conserva el estado de generación existente.
- Selección: las tarjetas radio muestran selección y habilitan Continuar.
- Edición: las sesiones se pueden expandir; cada sustitución actualiza el
  resumen sin perder series/repeticiones.
- Sin alternativas: se muestra el ejercicio actual con una explicación clara,
  sin dejar un selector vacío.
- Error de activación: se mantiene la propuesta editada y se permite reintentar.
- Móvil: CTA fijo, controles táctiles y contenido desplazable sin ocultar la
  acción primaria.

## Verificación

- Pruebas unitarias del orden de pasos guiado y autodirigido.
- Pruebas unitarias de selección de plantilla y alternativas compatibles.
- Pruebas de dominio que garantizan que las plantillas compatibles resuelven
  ejercicios activos.
- E2E móvil de selección, apertura de ejercicios, sustitución y activación sin
  registrar una sesión real.
- Verificación visual en viewport móvil y ejecución completa de lint,
  typecheck, tests y build.

## Fuera de alcance

- Registro público de usuarios.
- Inventario exacto por marca/modelo.
- Nuevas tablas o migraciones.
- Sustituciones entre patrones incompatibles.
- Catálogo de movilidad y estiramientos, que queda para una iteración
  posterior.
