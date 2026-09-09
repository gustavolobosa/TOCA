# TOCA

Prueba de concepto de enlaces NFC dinámicos y medibles. Cada etiqueta guarda una URL estable de TOCA; el panel permite cambiar su destino y ver cuántas veces se abrió.

## Requisitos

- Node.js 22 o superior
- Un proyecto de Supabase
- Una cuenta de Vercel para publicar la aplicación

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y completa las variables. Usa una clave `sb_publishable_...` para el navegador y una `sb_secret_...` solo en el servidor.

3. La base de datos de este POC ya tiene aplicadas las migraciones de `supabase/migrations`. Para enlazar una instalación nueva de la CLI y aplicar cambios futuros, ejecuta:

   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```

   El `project ref` aparece en la URL del proyecto y en **Project Settings → General**. `db push` sin `supabase link` muestra el error `Cannot find project ref`.

4. En Supabase, abre **Authentication → Users** y crea manualmente el usuario indicado en `ADMIN_EMAIL`. El MVP no ofrece registro público.

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
| `ADMIN_EMAIL` | Único correo autorizado en el POC |

## Seguridad del POC

- Todas las tablas tienen Row Level Security.
- El panel solo opera con la sesión del administrador.
- La clave secreta solo se importa desde módulos de servidor.
- La ruta pública registra `user-agent`, pero no guarda IP, cookies ni identificadores personales.
