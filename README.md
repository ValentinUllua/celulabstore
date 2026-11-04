# Celulab Store V4 — adaptación a Vercel + Supabase

Esta versión adapta la tienda **100 % mayorista** de V3.8 a Vercel. Mantiene el frontend, el carrito, los precios por volumen, WhatsApp, panel administrativo, pedidos, stock por modelo y etiquetas imprimibles. Sustituye SQLite por **PostgreSQL de Supabase** y `public/uploads` por **Supabase Storage**.

## Importante antes de publicarla

- **El proyecto todavía no está conectado a TU cuenta:** faltan valores reales en Vercel, ejecutar el esquema SQL y migrar los datos existentes. No se ha hecho un despliegue real ni pruebas de extremo a extremo en Vercel.
- **No subas al repositorio** contraseñas, credenciales, la base SQLite ni el `.env`. Solo las variables del servidor deben conocer `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_PASSWORD_HASH`.
- Guardá una copia de tu `data/celulab.sqlite` y carpeta `public/uploads/` de la V3.8 antes de migrar.
- **No aceptes pedidos reales** antes de probar la persistencia del stock, las imágenes y la recepción del WhatsApp en la URL de Vercel.
- El sistema sigue usando pedidos por WhatsApp, sin Mercado Pago, con mínimo mayorista de **$70.000**.

## 1. Crear el proyecto Supabase

1. Entrá en https://supabase.com y creá un proyecto.
2. En SQL Editor, ejecutá íntegramente `supabase/schema.sql` para crear tablas, índices y el bucket `productos`.
3. En Connect copiá la conexión de **Transaction Pooler** (puerto 6543) a `DATABASE_URL`. Reemplazá la contraseña que contiene el enlace por la contraseña real de la base. Si tiene caracteres especiales, codificalos como URL.
4. Copiá tu **Project URL** a `SUPABASE_URL` y tu **service_role/secret key** a `SUPABASE_SERVICE_ROLE_KEY` (nunca una clave `anon` ni una `publishable key`).

## 2. Preparar contraseña del administrador

Con Node.js 22+ y desde la carpeta del proyecto:

```bash
npm install
node scripts/hash-password.js "UnaClaveLargaDistintaYUnica2026!"
```

El comando muestra `ADMIN_PASSWORD_HASH=...`. Copiá el hash (no la contraseña en texto plano) a las variables privadas de Vercel. **La contraseña para entrar al panel será exactamente la que elegiste en ese comando.** No se migra la contraseña anterior de SQLite.

## 3. Importar catálogo, fotos y datos

Hay dos opciones: **A)** primera instalación sin datos previos; **B)** migrar instalación local V3.8.

**A) Tienda nueva:** cargá las variables en tu terminal y ejecutá `npm run seed` una vez. Se importan las familias y modelos del catálogo original con stock inicial cero. Si la base ya tiene productos, la semilla los respeta sin cambiarlos.

**B) Ya cargaste productos, imágenes, stock o pedidos:** usá el migrador con la **SQLite original** y la carpeta de fotografías original:

```bash
# Requiere DATABASE_URL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu entorno
node scripts/migrate-local.js "/ruta/anterior/data/celulab.sqlite" "/ruta/anterior/public/uploads"
```

**No hagas A y luego B si ya aceptaste pedidos en Supabase.** El migrador se detiene si detecta pedidos en la base destino y no garantiza recuperación automática de una migración interrumpida: restaurá desde el respaldo y revisá la base antes de reintentar. La contraseña y sesiones antiguas NO se importan. El migrador transfiere productos, variantes, stock, pedidos, movimientos, textos y fotografías referenciadas.

## 4. Publicar en Vercel

1. Subí esta carpeta como un repositorio **privado** a GitHub (no incluyas `.env`, SQLite ni fotos locales en `uploads`).
2. En Vercel: **Add New → Project → Import Git Repository**.
3. `Root Directory`: raíz del repositorio (donde está `vercel.json`). No necesitás compilar el frontend; Vercel entrega los archivos dentro de `public/` y ejecuta `api/index.js` como función.
4. En **Settings → Environment Variables**, agregá estas variables para Production:
   - `DATABASE_URL` — cadena de conexión PostgreSQL del Transaction Pooler de Supabase.
   - `SUPABASE_URL` — URL `https://...supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY` — clave secreta de servidor; **nunca** usarla en frontend.
   - `ADMIN_PASSWORD_HASH` — generado con `scripts/hash-password.js`.
   - `NODE_ENV=production`.
   - `SITE_URL=https://TU-PROYECTO.vercel.app` (o tu dominio final, exactamente, sin barra final).
5. Desplegá. Al cambiar variables, hacé **Redeploy**.
6. Comprobá `https://TU-PROYECTO.vercel.app/api/config` y `/api/products`. Nunca debería revelarse el stock exacto al público.
7. Abrí Administración, ingresá con tu contraseña, cargá stock por modelo, subí y asociá una foto, y realizá un pedido de prueba antes de lanzar al público.

Si después agregás un dominio, actualizá `SITE_URL` y desplegá de nuevo. El control `Origin` exige mismo dominio y HTTPS en producción. No se permiten peticiones administrativas desde otro sitio. Para previews de Vercel, adaptá `SITE_URL` en ese entorno a la URL de preview; no uses la URL de producción.

## 5. Cambios técnicos importantes

- `api/index.js` recibe las rutas `/api/*` vía `vercel.json`; el frontend sigue usando las mismas llamadas.
- `server/handler.js` implementa la API serverless.
- `server/store.js` hace consultas SQL con transacciones; pedidos descuentan stock de forma atómica y cancelaciones lo reponen.
- `supabase/schema.sql` crea las tablas. Las tablas con datos sensibles tienen **RLS habilitado sin políticas para clientes**. Solo el servidor se conecta a PostgreSQL mediante credenciales privadas.
- `server/handler.js` envía fotos a Supabase Storage; el cliente recibe URL pública de imagen de producto.
- Los pedidos contienen DNI, domicilio, teléfono y email: restringí acceso a Supabase y configurá copias de seguridad y una política de privacidad adecuada antes de publicar.
- El admin usa contraseña con scrypt (hash como variable de entorno), sesiones almacenadas en PostgreSQL, cookie HttpOnly/SameSite/secure (HTTPS) y límite persistente de intentos de acceso.

## 6. Cambiar la contraseña más adelante

Repetí `node scripts/hash-password.js "NUEVA-CLAVE-LARGA"`, reemplazá `ADMIN_PASSWORD_HASH` en Vercel y volvé a desplegar. Las sesiones existentes pueden seguir vivas hasta su caducidad (8 horas); si necesitás revocarlas inmediatamente, ejecutá `DELETE FROM public.sessions;` desde el SQL Editor de Supabase.

## 7. Pruebas

```bash
npm test
```

Se probaron de forma local las reglas de negocio: escalas de precio, suma por variantes, mínimo mayorista, rechazo minorista, stock, datos obligatorios del cliente, hash de contraseña e IDs. **No se pudo ejecutar una prueba real contra Supabase o Vercel** porque no hay proyecto ni credenciales de usuario conectadas en este entorno; también debe comprobarse la instalación y respuesta real de las dependencias en tu despliegue.

## 8. Ejecutar localmente con Supabase

Node.js 22 o superior. Configurá en el entorno `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD_HASH`, `NODE_ENV=development` y dejá `SITE_URL` sin definir. Instalá dependencias y ejecutá `npm start`. Abrí `http://localhost:3000`.

## 9. Diagnóstico si algo falla

- **No carga el catálogo**: revisá conexión `DATABASE_URL`, esquema ejecutado y Logs en Vercel.
- **No aparece una foto**: confirmá que el bucket `productos` sea público y que la imagen aparezca en Supabase Storage.
- **Credenciales incorrectas**: generá un hash nuevo para la contraseña elegida y reemplazá `ADMIN_PASSWORD_HASH` en Vercel, luego Redeploy.
- **403 Origen no autorizado**: revisá `SITE_URL`, el dominio abierto y HTTPS.
- **500 del servidor**: revisá la función en Vercel Logs; no coloques credenciales en capturas públicas.

