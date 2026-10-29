# Comunidad Cascarón

Plataforma de comunidad estilo Skool, open source y de marca neutra. Clónala,
conéctale tu Supabase y tu servidor de video, ponle tu marca y tienes una
comunidad propia con feed, cursos, calendario y videollamadas grupales.

Pensada para quien quiere montar una comunidad para su audiencia, una cohorte,
una consultoría grupal o un programa de formación, sin pagarle a una plataforma
por cada miembro.

## Qué trae

- **Feed**: posts con editor enriquecido, encuestas, comentarios anidados, likes, menciones, GIFs, categorías y posts fijados.
- **Classroom**: cursos con carpetas y lecciones, borradores, progreso por miembro, video embebido (YouTube, Vimeo, Loom) y 5 tipos de acceso: `open`, `level_unlock`, `buy_now`, `time_unlock`, `private`.
- **Calendario**: eventos únicos y recurrentes, zonas horarias, exportar a Google/Apple/ICS y recordatorios.
- **Videollamadas grupales** con LiveKit: sala con anfitrión, manos levantadas, turnos de palabra, chat, compartir pantalla y fondo virtual.
- **Miembros y mapa**: directorio con buscador y mapa mundial de miembros.
- **Gamificación**: puntos por participar, 9 niveles, leaderboard y cursos que se desbloquean por nivel.
- **Notificaciones**: en la app (tiempo real), push en la PWA y por correo (opcional).
- **Panel de admin**: analítica de miembros y retención, gestión de miembros (rol, tier, acceso), categorías, niveles y salas de video.
- **PWA**: instalable en el celular, con service worker propio.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Supabase (Auth, Postgres con RLS, Storage, Realtime) · LiveKit · Resend (opcional).

## Instalación en 15 minutos

Necesitas Node.js 20 o superior, una cuenta gratuita de [Supabase](https://supabase.com) y, para video, una cuenta de [LiveKit Cloud](https://cloud.livekit.io) (tiene plan gratuito) o tu propio servidor LiveKit.

### 1. Clona e instala (2 min)

```bash
git clone https://github.com/arbrain-ai/comunidad-cascaron.git mi-comunidad
cd mi-comunidad
npm install
cp .env.example .env.local
```

### 2. Crea la base de datos en Supabase (5 min)

1. En Supabase crea un proyecto nuevo.
2. En **Project Settings > API** copia `Project URL`, la llave `anon` y la llave `service_role` a tu `.env.local`.
3. Carga el esquema. Elige una opción:
   - **Con la CLI de Supabase** (recomendado):
     ```bash
     npx supabase login
     npx supabase link --project-ref TU_PROJECT_REF
     npx supabase db push
     ```
   - **Sin CLI**: abre **SQL Editor**, pega el contenido de `supabase/migrations/20261029000000_esquema_inicial.sql` y ejecútalo.
4. (Opcional) Carga datos de ejemplo: pega `supabase/seed.sql` en el SQL Editor. Crea categorías, un curso y un evento de demo.
5. En **Authentication > URL Configuration** pon tu URL (`http://localhost:3000` en local) como Site URL y agrégala a Redirect URLs.

### 3. Video con LiveKit (3 min)

En LiveKit Cloud crea un proyecto y copia a `.env.local`:

```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_API_URL=https://tu-proyecto.livekit.cloud
NEXT_PUBLIC_LIVEKIT_WS_URL=wss://tu-proyecto.livekit.cloud
```

Sin estas variables todo funciona menos las videollamadas.

### 4. Arranca y crea tu cuenta de owner (2 min)

```bash
npm run dev
```

Abre http://localhost:3000, regístrate y luego, en el SQL Editor de Supabase, hazte owner:

```sql
update public.profiles
set role = 'owner', has_community_access = true
where id = (select id from auth.users where email = 'tu@correo.com');
```

Recarga: ya ves el panel de admin en `/admin`. La primera vez te pedirá activar la verificación en dos pasos (Google Authenticator, 1Password, etc.): el panel de admin la exige siempre.

### 5. Publica (3 min)

**Vercel** (lo más rápido):

1. Sube tu repo a GitHub e impórtalo en [vercel.com/new](https://vercel.com/new).
2. Copia las variables de `.env.local` en **Settings > Environment Variables** y cambia `NEXT_PUBLIC_SITE_URL` por tu dominio.
3. Agrega tu dominio a las Redirect URLs de Supabase Auth.

**VPS propio** (Docker o Node):

```bash
npm ci
npm run build
NODE_ENV=production npm start   # puerto 3000; ponle Caddy o Nginx delante con HTTPS
```

La PWA, el micrófono y la cámara requieren HTTPS en producción.

## Acceso y cobro

Cada perfil tiene `has_community_access`. Por defecto un registro nuevo **no** tiene acceso y ve la página `/sin-acceso` hasta que un admin se lo activa desde `/admin > Miembros`. Si quieres una comunidad abierta, cambia el default de la columna:

```sql
alter table public.profiles alter column has_community_access set default true;
```

El cascarón no trae pasarela de pago. Para cobrar, conecta Stripe, Polar o Lemon Squeezy: su webhook (verificando la firma) debe poner `has_community_access = true` y registrar la compra en `community_purchases`. Pídeselo a tu agente de código: `AGENTS.md` le explica el modelo.

## Personaliza tu marca

| Qué | Dónde |
|-----|-------|
| Nombre, tagline, correo de soporte, URL | Variables `NEXT_PUBLIC_BRAND_*` o `src/shared/config/brand.ts` |
| Logo e íconos | `public/icon.svg`, `public/logo.png`, `public/icons/*`, `public/favicon.png`, `public/apple-touch-icon.png` |
| Nombre de la app instalada (PWA) | `public/manifest.json` y `APP_NAME` en `public/sw.js` |
| Colores y tipografía | `src/app/globals.css` y `tailwind.config.ts` |
| Niveles y premios | `src/features/gamification/config/levels.ts` |
| Categorías del feed | Panel `/admin > Categorías` |

Para regenerar todos los PNG a partir de tu `public/icon.svg`:

```bash
node -e "const s=require('sharp'),f=require('fs');const v=f.readFileSync('public/icon.svg');(async()=>{for(const n of [72,96,128,144,152,192,384,512])await s(v).resize(n,n).png().toFile('public/icons/icon-'+n+'x'+n+'.png');await s(v).resize(180,180).png().toFile('public/apple-touch-icon.png');await s(v).resize(256,256).png().toFile('public/logo.png');await s(v).resize(96,96).png().toFile('public/badge.png');await s(v).resize(48,48).png().toFile('public/favicon.png')})()"
```

## Opcionales

| Función | Variables |
|---------|-----------|
| Correos (avisos, recuperación) con Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` |
| Push en la PWA | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (genera con `npx web-push generate-vapid-keys`) |
| GIFs en posts | `NEXT_PUBLIC_GIPHY_API_KEY` |
| Video en tu propio host | `NEXT_PUBLIC_SELF_VIDEO_HOST` |

La lista completa está comentada en `.env.example`.

### Push y correos

Las notificaciones nuevas disparan un webhook desde la base hacia `/api/notifications/webhook`, que manda el push y, para anuncios, los correos. La base necesita saber a dónde llamar y con qué secreto. Genera un secreto (`openssl rand -hex 32`), ponlo en `SUPABASE_WEBHOOK_SECRET` y corre en el SQL Editor:

```sql
insert into public.app_config (key, value) values
  ('notifications_webhook_url', 'https://tu-dominio.com/api/notifications/webhook'),
  ('notifications_webhook_secret', 'EL_MISMO_SECRETO_DE_TU_ENV')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Sin estas dos filas la app funciona igual; solo no salen push ni correos de anuncios. En local el webhook no llega (la base no ve tu `localhost`): pruébalo ya publicado.

## Adáptalo con tu agente

El repo trae `AGENTS.md` (y `CLAUDE.md`, que lo importa) con la arquitectura, las reglas de seguridad y el modelo de acceso. Abre el proyecto con Claude Code, Codex o tu agente favorito y pídele cambios en lenguaje natural: "agrega un módulo de retos semanales", "conecta Stripe", "cambia la paleta a verde".

## Licencia

[Apache-2.0](LICENSE). Úsalo, modifícalo y véndelo como servicio; conserva el aviso de licencia.
