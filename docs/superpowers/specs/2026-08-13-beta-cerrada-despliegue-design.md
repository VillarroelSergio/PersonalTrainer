# Diseño de despliegue de beta cerrada de Trainer

**Fecha:** 2026-08-13
**Estado:** Actualizado para revisión

## Objetivo

Publicar Trainer como PWA instalable en iPhone para un piloto cerrado de un máximo de cuatro personas, sin tener que mantener un ordenador encendido y sin coste inicial de infraestructura. La aplicación debe conservar los datos entre publicaciones, no permitir el registro público y permitir que el responsable cree las cuentas manualmente con una contraseña inicial.

## Límites del piloto

- Máximo cuatro cuentas piloto activas, además de la cuenta operativa del responsable.
- No hay registro, invitaciones públicas, recuperación de contraseña ni cambio de contraseña desde la aplicación.
- El responsable crea y restablece credenciales desde una herramienta administrativa local; no hay un panel ni endpoint administrativo público.
- No hay notificaciones push, correo automático ni avisos de nuevas versiones.
- El usuario recibe los recursos de una versión nueva al volver a abrir o recargar la PWA con conexión. No se promete una actualización inmediata mientras la aplicación permanece abierta.
- El alcance funcional del MVP se mantiene: planificación y registro de fuerza, adaptación, PWA/offline y funcionalidades ya presentes. No se incorporan nuevas funciones de nutrición, chat, wearables directos ni usos clínicos.

## Arquitectura elegida

La beta usa dos servicios gratuitos administrados:

```text
iPhone / PWA
    |
    v HTTPS
Vercel Hobby: Next.js, rutas de API y service worker
    |
    +-- Supabase Postgres: Better Auth y datos de Trainer
    +-- Supabase Storage privado: archivos FIT, TCX y GPX
```

Vercel alojará la aplicación Next.js, las rutas de servidor y los assets públicos. El repositorio Git se conectará al proyecto Vercel y las publicaciones de producción se activarán manualmente desde una revisión validada. Vercel entrega HTTPS y no requiere que el equipo local permanezca encendido.

Supabase alojará todos los datos persistentes. La base SQLite actual y el directorio local `private-uploads/` no formarán parte del entorno de producción: el sistema de archivos de Vercel es efímero y no puede conservarlos entre ejecuciones.

El plan gratuito de Vercel solo es válido para uso personal y no comercial. Si el piloto se convierte en actividad comercial o supera cuotas, se deberá pasar a un plan de pago antes de continuar. El plan gratuito de Supabase ofrece capacidad suficiente para este piloto, pero puede pausar el proyecto tras una semana de actividad insuficiente; el responsable lo reanuda desde el panel si ocurre.

## Migración de persistencia

La aplicación cambiará de SQLite a Postgres antes de cualquier despliegue público:

- Drizzle pasará de `better-sqlite3` a un cliente Postgres compatible con ejecución serverless.
- El esquema y las migraciones se convertirán de SQLite a PostgreSQL.
- Los repositorios que dependen de manejadores `better-sqlite3` y de transacciones síncronas se adaptarán a transacciones Postgres asíncronas, conservando las mismas garantías de propiedad, idempotencia y conflicto.
- Better Auth usará el adaptador Drizzle de Postgres. No se sustituirá por Supabase Auth.
- Se migrarán los datos locales de prueba solo si el responsable decide conservarlos; de no ser necesarios, la beta empezará con una base vacía y las cuentas piloto creadas manualmente.

Todos los accesos a los datos de Trainer se mantendrán del lado servidor mediante las rutas y acciones de Next.js. No se expondrá al navegador una credencial privilegiada de Supabase. Si alguna tabla queda expuesta por la Data API, tendrá RLS activado y políticas de propiedad explícitas; la opción preferida es no acceder a las tablas de aplicación desde el cliente.

## Archivos privados e importaciones

Los archivos FIT, TCX y GPX se guardarán en un bucket privado de Supabase Storage. La base de datos conservará la clave del objeto, el nombre original, el tamaño, el hash y el resto del ciclo de vida ya definido.

Vercel Functions no recibe archivos de más de 4,5 MB y la aplicación admite archivos de hasta 15 MB. Por tanto, el navegador solicitará al servidor una URL de carga firmada, subirá directamente el archivo al bucket privado y después confirmará la importación mediante una ruta autenticada. El servidor verifica el usuario, nombre, tipo, tamaño, clave asignada y hash antes de crear o confirmar los registros de importación. Las descargas o lecturas futuras usarán autorización del servidor y URLs firmadas de duración limitada.

El bucket tendrá límites de tamaño y formatos permitidos, y políticas que impidan que una cuenta lea, escriba o borre archivos de otra.

## Identidad y altas manuales

En producción, Better Auth mantendrá `disableSignUp: true`. La pantalla de acceso solo permitirá iniciar sesión y no mostrará ninguna acción de creación de cuenta.

Se implementará un comando de administración local que reciba nombre, correo y contraseña inicial. El comando se conectará a Postgres mediante una variable local protegida y utilizará la API de servidor de Better Auth para generar el hash y las filas de cuenta correctas. No insertará hashes manualmente y no se desplegará como endpoint web.

El comando incluirá restablecimiento de contraseña bajo orden del responsable. No habrá flujo autoservicio de cambio o recuperación de contraseña para los usuarios piloto.

## Datos, secretos y backup

Vercel guardará como variables cifradas la URL pública de la aplicación, secretos de Better Auth, la cadena de conexión Postgres y las credenciales de servidor necesarias para emitir URLs firmadas de Storage. Ningún secreto se añadirá a Git, al cliente ni a archivos `.env` versionados.

Antes de cada migración o publicación se generará una exportación verificable de Postgres y, si hay importaciones, una copia de los objetos del bucket privado. Los backups se conservarán fuera de Vercel y Supabase, en un medio elegido y controlado por el responsable. El nivel gratuito de Supabase no aporta backups automáticos, por lo que esta exportación manual es obligatoria para cada release.

## Instalación y actualización de la PWA

La URL de producción se abre en Safari y se instala mediante “Compartir → Añadir a pantalla de inicio”. El manifiesto y el service worker existentes se conservarán y se validarán en un iPhone real.

Las actualizaciones se publicarán manualmente en Vercel. El service worker activa los recursos de la versión nueva al recuperarlos desde la red; al abrir o recargar, el usuario terminará recibiendo la nueva versión. No se muestra un aviso de versión ni se envía comunicación externa.

## Operación de releases

Cada release seguirá este orden:

1. Validar localmente build, lint, tipos, pruebas y migraciones de la versión candidata.
2. Crear un deployment Preview de Vercel y comprobar los flujos críticos con la base de pruebas.
3. Revisar el diff y confirmar que no incluye secretos, exportaciones de datos ni archivos de usuarios.
4. Crear y verificar el backup manual de Postgres y del bucket privado.
5. Aplicar las migraciones Postgres compatibles antes de promover la versión, con una comprobación posterior de esquema y datos.
6. Promover el Preview validado a producción en Vercel, sin reconstruir un artefacto diferente.
7. Verificar HTTPS, login, aislamiento de datos, inicio y registro de una sesión de fuerza, importación de un archivo válido y modo PWA instalado en iPhone.
8. Si falla una comprobación, revertir el deployment de Vercel; si una migración o datos lo requieren, restaurar el backup compatible anterior al release.

## Criterios de salida de la beta

- La URL opera únicamente por HTTPS y funciona en Safari iOS.
- Una cuenta creada manualmente inicia sesión y una cuenta inexistente no puede registrarse.
- Los datos de cada persona siguen separados por `ownerId` y persisten tras una nueva publicación de Vercel.
- La instalación desde Safari abre Trainer en modo independiente y permite registrar una serie.
- Un archivo de hasta 15 MB se carga mediante Storage privado sin atravesar una Function de Vercel y queda disponible solo para su propietario.
- Un backup reciente de Postgres y Storage puede localizarse y verificarse antes de publicar.
- El responsable puede crear y restablecer una cuenta sin editar directamente la base.

## Riesgos aceptados

- Vercel Hobby puede pausar el proyecto si se alcanzan sus límites; no permite uso comercial.
- Supabase Free puede pausar el proyecto después de una semana de baja actividad y no incluye backups automáticos.
- La migración de SQLite a Postgres modifica la capa de persistencia y requiere una regresión completa antes de abrir la beta.
- La actualización de una PWA no es instantánea para una aplicación que el usuario mantiene abierta y sin red.
- Al no existir recuperación de contraseña, el soporte de acceso recae íntegramente en el responsable.
