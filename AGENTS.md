# AGENTS.md: guía para el agente que adapte este cascarón

Eres el agente de código de quien clonó este repo. Tu trabajo es adaptar el
cascarón a SU comunidad: su marca, sus cursos, sus reglas de acceso. Lee este
archivo completo antes de tocar código.

## Qué es

Una plataforma de comunidad estilo Skool, lista para levantar:

| Módulo | Ruta | Carpeta |
|--------|------|---------|
| Feed (posts, encuestas, comentarios, likes, menciones) | `/community` | `src/features/community` |
| Classroom (cursos, carpetas, lecciones, progreso) | `/classroom` | `src/features/classroom` |
| Calendario (eventos, recurrencia, recordatorios) | `/calendar` | `src/features/calendar`, `src/features/agenda` |
| Videollamadas grupales (LiveKit) | `/call/[slug]` | `src/features/video-calling` |
| Miembros y mapa | `/members`, `/map` | `src/features/members`, `src/features/map` |
| Gamificación (puntos, 9 niveles, leaderboard) | `/leaderboard` | `src/features/gamification` |
| Notificaciones (in-app, push PWA, email) | `/notifications` | `src/features/notifications` |
| Búsqueda | `/search` | `src/features/search` |
| Perfil y ajustes | `/profile`, `/settings` | `src/features/profile` |
| Panel de admin (analítica, miembros, categorías, niveles, salas) | `/admin` | `src/features/admin` |

## Stack (no lo cambies sin que el humano lo pida)

- Next.js 16 (App Router) + React 19 + TypeScript estricto
- Tailwind CSS
- Supabase: Auth, Postgres con RLS, Storage, Realtime
- LiveKit para video (servidor propio o LiveKit Cloud)
- Resend + React Email para correos (opcional)
- Web Push con VAPID (opcional)
- Zod para validar entradas

> Next 16 trae cambios que rompen. Antes de escribir código de framework, lee
> la guía relevante en `node_modules/next/dist/docs/`. El "middleware" vive en
> `src/proxy.ts`; no existe `src/middleware.ts`.

## Arquitectura

Feature-first: cada feature trae sus `components/`, `hooks/`, `services/` y
`types/`. Lo compartido vive en `src/shared/`.

```
src/
├── app/                 # Rutas (App Router)
│   ├── (main)/          # Todo lo que requiere sesión y acceso
│   ├── api/             # Route handlers
│   ├── login/ · reset-password/ · sin-acceso/
│   └── layout.tsx
├── features/<feature>/  # Código por funcionalidad
├── shared/
│   ├── config/brand.ts  # PUNTO ÚNICO DE MARCA
│   ├── lib/             # Clientes de Supabase, auth helpers
│   └── components/ ...
└── proxy.ts             # Autenticación (getUser) y rutas públicas
supabase/
├── migrations/          # Esquema completo desde cero
└── seed.sql             # Datos mínimos de ejemplo (opcional)
```

## Seguridad: reglas que no se rompen

1. La autorización real vive en el servidor: `src/app/(main)/layout.tsx` lee
   `profiles.has_community_access` y `profiles.role` con datos frescos.
2. `src/proxy.ts` solo autentica, con `supabase.auth.getUser()`. Nunca uses
   `getSession()` para decidir acceso.
3. Todas las tablas tienen RLS. Si creas una tabla, crea su política en la misma
   migración.
4. `SUPABASE_SERVICE_ROLE_KEY` solo en código de servidor (route handlers,
   server actions). Jamás en componentes cliente ni en variables `NEXT_PUBLIC_*`.
5. Cambios de rol, tier o acceso pasan por `/api/admin/users/[id]` (servidor),
   nunca directo desde el navegador.
6. Nada de secretos en el repo: todo va en `.env.local` (ignorado por git).

## Modelo de acceso

- `profiles.role`: `owner` | `admin` | `moderator` | `member`.
- `profiles.has_community_access`: si es `false`, el usuario cae en `/sin-acceso`.
  Owners y admins siempre entran.
- `profiles.tier`: `no-paid` | `standard` | `vip`. Sirve para reglas finas
  (cursos, eventos, salas). VIP salta requisitos de nivel.
- Cursos: `open`, `level_unlock` (nivel 1 a 9), `buy_now`, `time_unlock`, `private`.

El cascarón NO trae pasarela de pago. Para cobrar: integra Stripe, Polar o Lemon
Squeezy, y que el webhook (verificando su firma) ponga
`has_community_access = true` y registre la compra en `community_purchases`.

## Cómo adaptar la marca

1. `src/shared/config/brand.ts` o las variables `NEXT_PUBLIC_BRAND_*`.
2. `public/logo.png`, `public/icon.svg`, `public/icons/*`, `public/favicon.png`,
   `public/apple-touch-icon.png`. Para regenerar los PNG desde `icon.svg`:
   `node -e` con `sharp` (ver README).
3. `public/manifest.json` y la constante `APP_NAME` de `public/sw.js` (el
   service worker no lee variables de entorno).
4. Colores: variables CSS en `src/app/globals.css` y `tailwind.config.ts`.
5. Niveles y premios: `src/features/gamification/config/levels.ts`.

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run typecheck  # tsc --noEmit
npm run lint
```

## Reglas de código

- TypeScript estricto. Nunca `any` (usa `unknown` y estrecha).
- Archivos de máximo 500 líneas y funciones de máximo 50 cuando escribas código
  nuevo. Si tocas un archivo grande, no lo hagas crecer: extrae.
- Nombres: `camelCase` variables y funciones, `PascalCase` componentes,
  `UPPER_SNAKE_CASE` constantes, `kebab-case` archivos nuevos.
- Valida entradas de API con Zod. Maneja errores; no los tragues en silencio.
- Layouts de pantalla completa con `h-dvh`, no `h-screen`.
- Antes de dar algo por terminado: `npm run typecheck` y `npm run build` en verde.

## Cuando el humano pida una feature nueva

1. Pregunta lo mínimo para entender el qué (no el cómo).
2. Crea la carpeta en `src/features/<feature>/`.
3. Migración nueva en `supabase/migrations/` con tabla + RLS + índices.
4. Implementa, corre typecheck y build, y prueba el flujo en el navegador.
5. Si un error te costó, documenta la lección en este archivo para que no se
   repita.
