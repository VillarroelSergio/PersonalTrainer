# Recursos visuales de interfaz

## Principio de uso

La interfaz usa iconos vectoriales para navegación, estados y acciones; las ilustraciones rasterizadas se reservan para onboarding, estados vacíos y momentos de motivación. Nunca deben competir con el registro durante una sesión.

## `icons.svg`

Sprite local sin dependencias. Sus símbolos utilizan `viewBox="0 0 24 24"`, trazo heredable (`currentColor` cuando se integre) y no contienen texto. Iconos disponibles: home, plan, train, library, history, checkin, run, bike, recovery, swap, share, import, goal, rest, timer, chevron e info.

## Ilustraciones editoriales

- `illustrations/hybrid-training-editorial-v1.webp`: recurso de onboarding o estado vacío; 640 px máximo y carga diferida.
- No se usa como hero permanente: solo en una superficie que ayude a comprender el plan híbrido o a desbloquear una acción.

La versión vigente es `hybrid-training-editorial-v2.webp`, con figura neutra y el mismo lenguaje editorial de las fichas de ejercicios.

### Estados vacíos

- `illustrations/empty-plan-v1.webp`: plan aún sin activar.
- `illustrations/empty-history-v1.webp`: historial aún sin sesiones.
- `illustrations/empty-import-v1.webp`: primera importación manual de una actividad.

Estos recursos son de apoyo contextual: se cargan bajo demanda y no sustituyen los mensajes ni las acciones accesibles del estado vacío.

Las ilustraciones son recursos originales generados para Trainer con ChatGPT el 9 de agosto de 2026. Sin texto, logos ni contenido de terceros.
