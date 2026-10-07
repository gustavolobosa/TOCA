# TOCA

Prueba de concepto de enlaces NFC dinámicos y medibles. Cada etiqueta guarda una URL estable de TOCA; el panel permite cambiar su destino y ver cuántas veces se abrió.

El repositorio incluye el MVP multiusuario. Su migración fue aplicada con autorización al proyecto actual el 7 de octubre de 2026; la publicación del código y su verificación en Vercel son pasos separados. Consulta el estado y las comprobaciones en `MVP_MULTIUSER.md` y `QA_REAL.md` antes de ejecutar comandos contra Supabase o publicar.

## Requisitos

- Node.js 22.x (la misma versión mayor configurada para Vercel)
- Un proyecto de Supabase
- Una cuenta de Vercel para publicar la aplicación

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y completa las variables. Usa una clave `sb_publishable_...` para el navegador y una `sb_secret_...` solo en el servidor.

3. La base de datos de este POC tiene aplicadas las migraciones hasta `20261006015536_multiuser_nfc_destinations_and_history.sql`. Las posteriores pueden estar en preparación: no ejecutes `db push` sin revisar cuáles aplicará y autorizar sus cambios. Para enlazar una instalación nueva de la CLI y aplicar cambios futuros aprobados, ejecuta:

   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```

   El `project ref` aparece en la URL del proyecto y en **Project Settings → General**. `db push` sin `supabase link` muestra el error `Cannot find project ref`.

4. En Supabase, abre **Authentication → Users** y copia el UUID de tu cuenta administradora a `ADMIN_USER_ID`. Usa una contraseña fuerte y exclusiva; nunca uses la contraseña de prueba ni compartas una cuenta. El MVP no ofrece registro público.

5. Inicia la aplicación:

   ```bash
   npm run dev
   ```

## Prueba con un NFC

1. Crea un enlace desde el panel.
2. Copia la URL `https://tu-dominio/t/slug`.
3. En NFC Tools elige **Escribir → Añadir un registro → URL/URI** y graba esa URL.
4. Acerca el teléfono a la etiqueta. TOCA registra la visita y redirige al destino configurado.
5. Cambia el destino en el panel y vuelve a acercar el teléfono: no es necesario reprogramar la etiqueta.

## Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Dominio público de Vercel, sin `/` final |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública para autenticación y RLS |
| `SUPABASE_URL` | URL de Supabase usada por el servidor |
| `SUPABASE_SECRET_KEY` | Clave secreta para resolver enlaces y guardar visitas |
| `SUPABASE_DB_PASSWORD` | Solo para ejecutar migraciones; no la usa Next.js |
| `ADMIN_USER_ID` | UUID de la única cuenta administradora; solo se usa en el servidor |

## Seguridad del POC

- Todas las tablas tienen Row Level Security.
- Cada propietario ve sus NFC y su historial; solo el administrador crea cuentas, crea etiquetas o cambia propietarios. El servidor verifica la sesión, el perfil activo y la propiedad en cada acción.
- El administrador debe cambiar la contraseña inicial y verificar un segundo factor TOTP; los clientes deben reemplazar su contraseña temporal individual.
- La clave secreta solo se importa desde módulos de servidor.
- La ruta pública nueva guarda fecha, NFC, destino y tipo, sin IP, user-agent ni identificadores del visitante. Los eventos heredados no se borran. Las visitas no prueban reseñas, personas únicas ni mensajes enviados.
- Los permisos administrativos se verifican por ID en cada acción; el correo y los datos editables de perfil no otorgan permisos.
- Las páginas de autenticación y panel no se almacenan en caché compartida.
- Se bloquea la carga dentro de iframes y el envío del referente a los destinos externos.
- La URL del sitio debe ser HTTPS en producción y Preview. `http://localhost:3000` solo se admite en desarrollo.
- Las URLs públicas y privadas de Supabase deben apuntar al mismo proyecto.

## Configuración de producción

El código local usa `ADMIN_USER_ID`. Antes de desplegar, configura esa variable en Vercel, tanto en Production como en Preview, con el UUID de la cuenta actual. Conserva `NEXT_PUBLIC_SITE_URL=https://toca-one.vercel.app` en Production; no copies la URL local al despliegue.

La migración `20261006013618_harden_single_admin_access.sql` fue aplicada con autorización explícita al proyecto `sixsesexcfklnaiqzlqm`. Reemplaza las políticas basadas en correo por el ID del administrador, restringe las columnas actualizables e impide que borrar una cuenta o un NFC elimine su historial por cascada. Su UUID debe coincidir con `ADMIN_USER_ID`; para otra instalación se debe adaptar antes de aplicarla. Las comprobaciones de lectura confirmaron sus permisos y conservaron un NFC y sus dos visitas. No cambia cuentas ni contraseñas. Las migraciones posteriores requieren su propia aprobación; no ejecutar `db push` para comprobarlas: ese comando modifica la base.

## Verificación local

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Las pruebas unitarias usan el runner nativo de Node.js. Playwright ejecuta los flujos de la aplicación con Supabase simulado en memoria: no carga credenciales reales ni escribe en tu base. No demuestra RLS ni transacciones reales. El script usa Playwright instalado, `TOCA_PLAYWRIGHT_PATH` o el runtime local de Codex, y Chrome; no agrega dependencias a la aplicación. Debe ejecutarse con el puerto 3212 libre y sin otro `next dev` en este repositorio.

Las pruebas contra Supabase real que inicien sesión, creen cuentas, modifiquen etiquetas o registren visitas requieren autorización sobre los datos y el entorno exactos.

Para verificar también las respuestas HTTP anónimas y las cabeceras de producción, construye con `NEXT_PUBLIC_SITE_URL=https://toca-one.vercel.app npm run build`, inicia `npm start` con esa misma variable y ejecuta en otra terminal `TOCA_TEST_BASE_URL=http://localhost:3000 npm test`. Esta prueba solo admite un servidor local, no inicia sesiones ni abre URLs NFC que registren visitas. Next.js en desarrollo usa cabeceras de revalidación distintas, por lo que esta comprobación exige un build de producción.

## Decisiones del MVP multiusuario

El alcance aprobado, el estado de cada épica y el orden seguro de aplicación están documentados en `MVP_MULTIUSER.md`. El código nuevo requiere la migración multiusuario, ya aplicada en el Supabase actual. Para otras instalaciones, revisa el UUID administrativo de las migraciones antes de ejecutarlas.
