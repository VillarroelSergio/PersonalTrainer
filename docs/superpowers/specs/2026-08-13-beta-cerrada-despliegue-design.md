# Diseño de despliegue de beta cerrada de Trainer

**Fecha:** 2026-08-13
**Estado:** Aprobado para planificación

## Objetivo

Publicar Trainer como PWA instalable en iPhone para un piloto cerrado de un máximo de cuatro personas. La aplicación debe conservar sus datos entre publicaciones, no permitir el registro público y permitir que el responsable cree las cuentas manualmente con una contraseña inicial.

## Límites del piloto

- Máximo cuatro cuentas piloto activas, además de la cuenta operativa del responsable.
- No hay registro, invitaciones públicas, recuperación de contraseña ni cambio de contraseña desde la aplicación.
- El responsable crea, desactiva y restablece credenciales fuera de la interfaz pública mediante una herramienta local de administración.
- No hay notificaciones push, correo automático ni avisos de nuevas versiones.
- El usuario recibe la actualización al volver a abrir o recargar la PWA con conexión; no se promete una actualización inmediata mientras la aplicación permanece abierta.
- El alcance funcional del MVP se mantiene: planificación y registro de fuerza, adaptación, PWA/offline y funcionalidades ya presentes. No se incorporan nuevas funciones de nutrición, chat, wearables directos ni usos clínicos.

## Arquitectura elegida

Se desplegará una única instancia de la aplicación Next.js en un servicio web de pago de Render, con HTTPS administrado por el proveedor y un disco persistente adjunto. La instancia alojará la base SQLite y los archivos privados de importaciones en rutas dentro de ese disco.

La aplicación no se desplegará en una plataforma serverless con sistema de archivos efímero. SQLite y los archivos privados actuales requieren persistencia local. La instancia permanecerá única: un disco de Render no se comparte entre varias instancias y el piloto no necesita escalado horizontal.

Cada publicación puede producir una indisponibilidad breve porque el servicio con disco persistente se reemplaza de manera secuencial. El procedimiento de release debe reservar una ventana corta y comprobar la salud del servicio después de cada publicación.

## Datos y secretos

El disco persistente contiene únicamente:

- La base de datos SQLite de producción.
- El directorio de ficheros privados cargados por los usuarios.

Las rutas se definirán explícitamente con variables de entorno; no se usarán las rutas relativas de desarrollo. Los secretos de autenticación y la URL pública se guardarán exclusivamente en el panel de variables cifradas del proveedor. Nunca se añadirán a Git ni a archivos `.env` versionados.

Antes de cualquier migración o despliegue se generará una copia consistente de la base SQLite y de los archivos privados. Se conservarán copias rotativas fuera del servicio. Los snapshots diarios del disco son una protección adicional, no el mecanismo de recuperación principal.

## Identidad y altas manuales

En producción, Better Auth mantendrá `disableSignUp: true`. La pantalla de acceso solo permitirá iniciar sesión y no mostrará una acción de creación de cuenta.

Se implementará un comando local de administración que reciba nombre, correo y contraseña inicial. El comando usará la API de servidor de Better Auth contra la base de producción para generar el hash de contraseña y las filas de cuenta con el formato correcto; no insertará hashes manualmente ni expondrá un endpoint administrativo en Internet.

El mismo comando ofrecerá una operación de restablecimiento de contraseña solicitada por el responsable. No habrá flujo autoservicio para usuarios piloto.

## Instalación y actualización de la PWA

La URL pública se abrirá en Safari para instalarla mediante “Compartir → Añadir a pantalla de inicio”. El manifiesto y el service worker existentes se conservarán y se validarán en un iPhone real.

Las actualizaciones se publicarán manualmente. El service worker activa los recursos de la versión nueva al recuperar la aplicación desde la red; al abrirla o recargarla, el usuario terminará recibiendo la nueva versión. No se muestra un aviso de versión ni se envía comunicación externa.

## Operación de releases

Cada release seguirá este orden:

1. Validar localmente build, lint, tipos y pruebas de la versión candidata.
2. Revisar el diff y confirmar que no incluye secretos, bases de datos ni archivos de usuarios.
3. Crear backup verificable de la base y las cargas privadas.
4. Aplicar migraciones de base de datos de forma controlada.
5. Desplegar manualmente una revisión concreta y registrada.
6. Verificar HTTPS, login, carga de datos, inicio y registro de una sesión de fuerza y el modo PWA instalado en iPhone.
7. Si falla una comprobación, restaurar código y, cuando corresponda, los datos desde la copia compatible anterior al release.

## Criterios de salida de la beta

- La URL opera únicamente por HTTPS y funciona en Safari iOS.
- Una cuenta creada manualmente inicia sesión; una cuenta inexistente no puede registrarse.
- Los datos de cada usuario siguen separados por `ownerId` y persisten tras un redeploy.
- La instalación desde Safari abre Trainer en modo independiente y permite registrar una serie.
- Un backup reciente puede localizarse y verificarse antes de publicar.
- El responsable puede crear y restablecer una cuenta sin editar directamente SQLite.

## Riesgos aceptados

- Una instancia única implica una breve parada durante el deploy y no ofrece alta disponibilidad.
- SQLite es apropiado solo mientras el piloto conserve baja concurrencia y una sola instancia.
- La actualización de una PWA no es instantánea para una aplicación que el usuario mantiene abierta y sin red.
- Al no existir recuperación de contraseña, el soporte de acceso recae íntegramente en el responsable.
