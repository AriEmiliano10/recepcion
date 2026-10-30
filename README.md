# Sistema de Recepción

Sistema web para gestionar preregistros, autorización y entradas/salidas de visitantes.
La interfaz sigue en HTML, CSS y JavaScript; las cuentas y las visitas se guardan en
PostgreSQL mediante Netlify Functions y Neon. No usa React.

## Preparar la base de datos

1. Crea una base de datos PostgreSQL en Neon y copia su cadena de conexión.
2. En el editor SQL de Neon, ejecuta en orden [`netlify/migrations/001-init.sql`](./netlify/migrations/001-init.sql)
   y [`netlify/migrations/002-directory.sql`](./netlify/migrations/002-directory.sql).
   Crean las tablas de empresas, usuarios, sesiones, visitas y contactos, e insertan el
   catálogo inicial de empresas.
3. En PowerShell, define la conexión y las cuentas iniciales. Usa contraseñas propias
   de al menos 12 caracteres:

   ```powershell
   $env:DATABASE_URL = 'postgresql://usuario:contraseña@host/base?sslmode=require'
   $env:SEED_USERS_JSON = '[{"id":"recepcion-1","username":"recepcion","name":"Recepción principal","role":"RECEPCION","password":"CAMBIAR-ESTA-CLAVE-POR-UNA-PROPIA-12"},{"id":"empresa-alfa","username":"alfa","name":"Administrador Alfa","role":"EMPRESA","companyId":"emp-001","password":"CAMBIAR-ESTA-OTRA-CLAVE-12"},{"id":"piso-1","username":"piso1","name":"Perfil Piso 1","role":"PISO","floor":1,"password":"CAMBIAR-ESTA-TERCERA-CLAVE-12"}]'
   npm install
   npm run seed
   npm run seed:directory
   ```

   Los contactos se leen desde `data/directorio.json`, un archivo local excluido de Git,
   con campos `nombre`, `empresa`, `piso` y `celular`. Conserva ahí el directorio autorizado
   y no lo subas al repositorio. El script lo guarda en Neon; la aplicación solo lo devuelve
   a usuarios con sesión y limita los perfiles de empresa y piso a los contactos de su piso.

   Agrega al arreglo las cuentas que necesites. Los roles permitidos son `RECEPCION`,
   `EMPRESA` y `PISO`. Una cuenta de empresa debe tener un `companyId` existente; una
   cuenta de piso debe tener un `floor` entre 1 y 6. El script guarda contraseñas
   derivadas con `scrypt`, no el texto original.

   No incluyas `DATABASE_URL`, contraseñas ni archivos `.env` en Git. `npm run seed`
   actualiza las cuentas con los mismos ids si vuelves a ejecutarlo.

## Ejecutar localmente

Después de preparar la base y las cuentas, instala dependencias y arranca Netlify Dev:

```powershell
npm install
$env:DATABASE_URL = 'postgresql://usuario:contraseña@host/base?sslmode=require'
npm run build
npm run dev
```

Abre la dirección local que muestra Netlify CLI. No abras los HTML con doble clic:
las funciones `/api` requieren el servidor de desarrollo.

## Desplegar en Netlify

1. Sube el proyecto a un repositorio Git y conéctalo desde Netlify.
2. En las variables de entorno del sitio, define `DATABASE_URL` con la cadena de Neon.
3. Publica el sitio. [`netlify.toml`](./netlify.toml) construye y publica `dist/`,
   y dirige `/api/*` a la función. El build copia solo HTML, CSS, JS e imágenes al
   directorio público; documentos, pruebas y scripts de administración no se publican.
   Para que las personas usen el login propio de la aplicación, deja pública la producción
   en **Project configuration → General → Visitor access → Project visibility**; los previews
   pueden seguir privados. La API conserva su autenticación por sesión.
4. Si necesitas cargar cuentas o rotar contraseñas, ejecuta `npm run seed` desde un
   equipo confiable con `DATABASE_URL` apuntando a la misma base.

## API disponible

- `POST /api/auth/login`: inicia sesión y establece una cookie `HttpOnly`.
- `GET /api/auth/session`: devuelve el perfil asociado a la sesión.
- `POST /api/auth/logout`: revoca la sesión.
- `GET /api/visits`: devuelve solo visitas permitidas para el rol autenticado.
- `POST /api/visits`: registra una visita.
- `POST /api/visits/:id/{arrival,authorize,reject,entry,exit,cancel}`: procesa el flujo.

Recepción puede ver y procesar todas las visitas. Las empresas solo consultan y cancelan
las de su empresa; los perfiles de piso quedan limitados a su piso. Solo recepción puede
marcar llegada, autorizar/rechazar y registrar entrada/salida. El QR sigue identificando
la visita; por sí mismo no autoriza el acceso.

## Notas de migración

- Las cuentas de prueba en texto plano ya no se cargan en el navegador; crea cuentas
  reales con `SEED_USERS_JSON`. El formulario de login no tiene credenciales iniciales.
- Los nombres y teléfonos del directorio ya no se publican en los archivos del frontend;
  ejecuta la migración 002 y `npm run seed:directory` para cargarlos en Neon.
- Las visitas creadas anteriormente en `localStorage` no se copian automáticamente a
  Neon. Exporta y valida cualquier historial que necesites conservar antes de retirar
  la versión anterior.
- El catálogo de empresas y el directorio de contactos siguen siendo catálogos estáticos
  del frontend; el directorio aún se inicializa en `localStorage`. Las visitas y las
  cuentas sí son compartidas por todos los dispositivos mediante el backend.
- La autenticación usa sesiones revocables con cookie `HttpOnly`, caducidad de ocho
  horas y contraseñas derivadas con `scrypt`. Para uso público, añade límites de
  intentos de login y administración segura de cuentas antes de abrir el sitio a
  usuarios externos.
