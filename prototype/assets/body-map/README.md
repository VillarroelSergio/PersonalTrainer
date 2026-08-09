# Mapa corporal de molestias

`body-map-front-back-v1.webp` es el recurso visual base para el check-in de molestias. Es una ilustración original de dos vistas, frontal y trasera, optimizada para móvil.

## Uso correcto

- Tamaño: 640 × 800 px, WebP, 13.5 KB.
- No representa un diagnóstico, grupos musculares concretos ni una lesión.
- Sus divisiones son solo referencia visual. La interacción real debe implementarse con zonas amplias accesibles superpuestas en HTML/SVG: cuello/cabeza, hombro izquierdo/derecho, torso, brazo izquierdo/derecho, cadera, pierna izquierda/derecha y rodilla/tobillo izquierdo/derecho.
- La imagen se mantiene neutra. El estado seleccionado, foco y `aria-pressed` se aplican en las zonas interactivas, no alterando el archivo de imagen.
- En móvil se muestra una vista por vez mediante pestañas Frontal / Trasera; en escritorio se pueden mostrar ambas vistas con los mismos controles semánticos.
- Debe tener un fallback basado en botones de texto si la imagen no carga.

## Accesibilidad

La imagen debe llevar un `alt` breve, por ejemplo: `Mapa corporal frontal y trasero con zonas amplias para registrar una molestia.` Las zonas no dependen de coordenadas opacas: son botones con nombre legible, foco visible y teclado.

## Procedencia

Ilustración original generada con ChatGPT para Trainer el 9 de agosto de 2026. No utiliza imágenes ni recursos de terceros.
