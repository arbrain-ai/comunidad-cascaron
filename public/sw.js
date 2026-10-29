/**
 * Service Worker de la comunidad
 *
 * PUSH: handlers idénticos a los validados en iOS Safari PWA (no tocar).
 *
 * CACHING (v6, Goal 2 "La app vuela") — CIRUGÍA iOS-SAFE:
 * El incidente de enero 2026
 * lo causó un fetch handler catch-all (Serwist/Workbox) que interceptaba TODO,
 * incluidas navegaciones. Este handler es lo contrario — una ALLOWLIST estricta:
 *   - SOLO method GET + same-origin
 *   - SOLO /_next/static/* (immutable por hash → cache-first, ignoreSearch
 *     para sobrevivir el cache-busting ?dpl= de Vercel entre deploys)
 *   - SOLO assets de marca/íconos/sonidos exactos → stale-while-revalidate
 *   - JAMÁS navegaciones/HTML, /api, /auth, sw.js, manifest.json, cross-origin,
 *     ni NADA con datos de perfil/billing (ese payload causó el bug de acceso
 *     stale post-cancelación — network-only para siempre)
 *   - Todo lo no listado: early-return SIN respondWith → red normal del browser
 * Kill-switch: (1) message SW_CACHE_OFF apaga el caching y purga caches;
 * (2) cualquier error → fallback a red; (3) deploy de una versión nueva
 * reemplaza este archivo (max-age=0 en sw.js).
 */

// Cambia APP_NAME por el nombre de tu comunidad (el SW no lee variables de entorno)
const APP_NAME = 'Mi Comunidad'
const SW_VERSION = 'v6.2.0' // v6.2: el tag del push lo decide el servidor (avisos que ya no se tapan)

const CACHE_PREFIX = 'comunidad-'
const CACHE_STATIC = `${CACHE_PREFIX}static-${SW_VERSION}`  // /_next/static (immutable)
const CACHE_ASSETS = `${CACHE_PREFIX}assets-${SW_VERSION}`  // marca/íconos/sonidos (SWR)

// Assets de marca cacheables (allowlist EXACTA por prefijo seguro)
const ASSET_PREFIXES = ['/icons/']
const ASSET_EXACT = [
  '/logo.png', '/badge.png', '/favicon.ico', '/apple-touch-icon.png',
]

let cacheDisabled = false // kill-switch en runtime (via message SW_CACHE_OFF)

// Event: Install
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', SW_VERSION)
  self.skipWaiting() // Activar inmediatamente
})

// Event: Activate
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', SW_VERSION)

  event.waitUntil(
    Promise.all([
      // Limpiar SOLO caches comunidad-* de versiones anteriores (no auto-destruirse).
      // El filtro respeta el prefijo: caches ajenos al SW no se tocan (7 ago 2026,
      // antes borraba cualquier cache del origin, contradiciendo este comentario)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_STATIC && name !== CACHE_ASSETS)
            .map((name) => {
              console.log('[SW] Eliminando cache antigua:', name)
              return caches.delete(name)
            })
        )
      }),
      // Tomar control de todas las páginas inmediatamente
      clients.claim()
    ])
  )
})

// ============================================
// Fetch — allowlist quirúrgica (ver header)
// ============================================
function isStaticChunk(url) {
  return url.pathname.startsWith('/_next/static/')
}

function isBrandAsset(url) {
  return (
    ASSET_EXACT.includes(url.pathname) ||
    ASSET_PREFIXES.some((p) => url.pathname.startsWith(p))
  )
}

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_STATIC)
    // ignoreSearch: el contenido es hash-immutable; ?dpl= cambia por deploy
    const hit = await cache.match(request, { ignoreSearch: true })
    if (hit) return hit
    const response = await fetch(request)
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch (err) {
    return fetch(request)
  }
}

async function staleWhileRevalidate(request, event) {
  try {
    const cache = await caches.open(CACHE_ASSETS)
    const hit = await cache.match(request, { ignoreSearch: true })
    const refresh = fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {})
        }
        return response
      })
    if (hit) {
      event.waitUntil(refresh.catch(() => {}))
      return hit
    }
    return await refresh
  } catch (err) {
    return fetch(request)
  }
}

self.addEventListener('fetch', (event) => {
  // GUARDAS DURAS — si CUALQUIERA aplica, NO llamamos respondWith:
  // el browser sigue su camino normal (esto es lo que mantiene iOS a salvo)
  if (cacheDisabled) return
  // DEV JAMÁS cachea: los chunks de Turbopack en dev NO llevan hash de
  // contenido → cache-first los sirve VIEJOS tras cada edición (mordió 2
  // veces el 7 ago 2026). En prod los chunks sí son immutable por hash.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return
  if (event.request.method !== 'GET') return
  if (event.request.mode === 'navigate') return // HTML JAMÁS se cachea aquí

  let url
  try {
    url = new URL(event.request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return // cross-origin: ni tocarlo
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return

  if (isStaticChunk(url)) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  if (isBrandAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, event))
    return
  }

  // Todo lo demás: sin respondWith → red normal
})

// Event: Push - CRITICO para recibir notificaciones
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  let notificationData = {
    title: APP_NAME,
    body: 'Nueva notificacion',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'comunidad-notification',
  }

  // Parsear datos del push
  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || {},
      }
    } catch (error) {
      console.error('[SW] Error parsing push data:', error)
      notificationData.body = event.data.text()
    }
  }

  // Opciones de la notificacion
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    // El tag lo decide QUIEN envia (ver api/notifications/webhook): los DMs
    // se agrupan por conversacion y el resto es un aviso por evento. Antes
    // este tag era fijo para todo, asi que cada notificacion nueva TAPABA la
    // anterior: un mensaje de alguien borraba el aviso de otra persona.
    tag: notificationData.tag,
    requireInteraction: false,
    data: notificationData.data,
  }

  // Mostrar la notificacion
  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  )
})

// Event: Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received')

  event.notification.close()

  // Abrir la aplicacion
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const data = event.notification.data || {}
      // Un DM abre SU conversacion. El trigger de la base guarda la url vieja
      // (`/messages?conversation=<id>`) y la pagina lee `?c=`, asi que el push
      // aterrizaba en la bandeja sin abrir nada. Con conversation_id a la mano
      // la url se arma aqui, y eso arregla tambien los avisos ya enviados.
      const urlToOpen = data.conversation_id
        ? `/messages?c=${data.conversation_id}`
        : data.url || '/'

      // Si ya hay una ventana abierta, enfocarla Y navegar a la URL
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }

      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Event: Message - Comunicacion con la app principal
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Kill-switch del caching (Goal 2): apaga el fetch handler y purga caches.
  // Uso de emergencia desde consola:
  //   navigator.serviceWorker.controller.postMessage({type:'SW_CACHE_OFF'})
  if (event.data && event.data.type === 'SW_CACHE_OFF') {
    cacheDisabled = true
    caches.keys().then((names) =>
      names.filter((n) => n.startsWith(CACHE_PREFIX)).forEach((n) => caches.delete(n))
    )
    console.warn('[SW] Cache kill-switch ACTIVADO: caching apagado, caches purgadas')
  }
})

// Helper: VAPID key base64 URL -> Uint8Array (mismo helper que usePushSubscription)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Event: Push Subscription Change - Auto-reactivación
// Este evento se dispara cuando el browser (Apple/Google) invalida el token silenciosamente
// Solución estándar documentada en MDN, usada por OneSignal, Firebase FCM
//
// Fix 2026-07-06: (1) si oldSubscription es null, antes se suscribía SIN
// applicationServerKey y fallaba en silencio -> ahora se pide la key a
// /api/notifications/vapid; (2) el fetch manda cookies (credentials) y
// oldEndpoint para que el server herede el user_id dueño del dispositivo
// (antes insertaba filas huérfanas user_id=NULL, intargeteables).
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed - auto-resubscribing')

  event.waitUntil(
    (async () => {
      try {
        // 1. Conseguir un applicationServerKey confiable
        let subscribeOptions = event.oldSubscription?.options
        if (!subscribeOptions?.applicationServerKey) {
          const vapidRes = await fetch('/api/notifications/vapid')
          if (!vapidRes.ok) throw new Error('No VAPID key available')
          const { publicKey } = await vapidRes.json()
          subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }
        }

        // 2. Crear nueva suscripción
        const newSubscription = await self.registration.pushManager.subscribe(subscribeOptions)

        console.log('[SW] New subscription created:', newSubscription.endpoint)

        // 3. Enviar al servidor. La identidad la resuelve el server:
        //    cookie de sesión (viaja con credentials) o herencia por oldEndpoint.
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription.toJSON(),
            oldEndpoint: event.oldSubscription?.endpoint,
            deviceInfo: {
              userAgent: navigator.userAgent,
              timestamp: Date.now(),
              reason: 'pushsubscriptionchange'
            }
          })
        })

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`)
        }

        console.log('[SW] Auto-resubscribe successful')
      } catch (error) {
        console.error('[SW] Auto-resubscribe failed:', error)
        // No throw - queremos que falle silenciosamente para el usuario
      }
    })()
  )
})

console.log('[SW] Service Worker loaded - version:', SW_VERSION)
