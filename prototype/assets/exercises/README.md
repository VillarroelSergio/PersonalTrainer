# Recursos visuales de ejercicios

Esta carpeta es el catálogo editorial local que consumirá la ficha individual de ejercicio. Las imágenes no deben mostrarse en el listado general: se cargan solo al abrir una ficha o guía.

## Convención

- `manifest.json` enlaza el `exerciseId` del catálogo con su recurso y texto alternativo.
- Las ilustraciones viven en `illustrations/` y usan WebP, 560 px de ancho máximo, relación aproximada 4:5 y objetivo inferior a 45 KB (nunca más de 80 KB).
- El componente debe utilizar `loading="lazy"`, dimensiones conocidas y un fallback visual cuando `status` sea `pending`.
- No incrustar binarios/base64 en JavaScript ni en la futura base de datos.

## Dirección visual

Ilustración original de técnica: fondo grafito cálido, línea marfil, acento naranja limitado a músculos implicados. Una persona genérica, sin texto, marcas, logotipos ni fondo de gimnasio. La posición debe enseñar el punto de ejecución, no afirmar diagnóstico ni prescripción.

## Licencia y procedencia

`jalon-polea-agarre-ancho-v1.webp` es un recurso original generado para Trainer con ChatGPT el 8 de agosto de 2026. No procede de Simply Fitness ni de otra biblioteca externa. Antes de incorporar recursos de terceros se debe registrar licencia, atribución y permiso de uso.

## Dirección editorial vigente

Desde la versión `v2`, toda ilustración debe usar una figura humana neutra: sin pelo, rostro, vello, rasgos faciales, proporciones ni vestimenta asociables a un género. Mantener fondo grafito, línea marfil y naranja apagado reservado a músculos principales. Las versiones anteriores que no cumplan esta línea y no estén referenciadas se eliminan; el manifiesto es la fuente de verdad.

## Lote actual y procedencia

El catálogo inicial contiene 33 ilustraciones disponibles, originales y generadas para Trainer con ChatGPT el 8 y 9 de agosto de 2026. No proceden de Simply Fitness ni de otra biblioteca externa. Antes de incorporar recursos de terceros se debe registrar licencia, atribución y permiso de uso.

## Flujo para añadir un recurso

1. Generar una ilustración original siguiendo la dirección visual.
2. Revisar que represente la técnica de manera general y no incluya texto o marcas.
3. Redimensionar y convertir a WebP.
4. Comprobar peso, dimensiones, contraste y `alt` descriptivo.
5. Actualizar el elemento correspondiente del manifiesto a `available`.
