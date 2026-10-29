/**
 * usePushSubscription Hook
 *
 * Base: la versión simple de noviembre 2025 que funciona en iOS Safari PWA.
 *
 * + Reconciliación navegador <-> BD (2026-07-06, Goal 1 "El canal revive"):
 *   el toggle mostraba "activo" para siempre porque solo miraba
 *   pushManager.getSubscription() y la BD podía no tener nada (write-path
 *   roto desde 13-abr). Ahora, UNA VEZ por sesión de navegador, se compara
 *   contra GET /api/notifications/status y si el navegador tiene suscripción
 *   pero la BD no, se re-registra en silencio (self-heal).
 *
 * CICATRIZ DE ENERO (commit 7d78018 -> revert 3f22be6, "loops infinitos,
 * race conditions"): la detección de zombies client-side reactiva NUNCA
 * funcionó. Por eso esta reconciliación es deliberadamente:
 *   - once-per-session (flag en sessionStorage, la ganan al primer mount)
 *   - con backoff de 6h en localStorage si el server falla
 *   - flujo lineal sin dependencias de estado (no puede re-dispararse a sí misma)
 *   - fallback al estado local del navegador si la red falla
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

type PermissionStatus = 'default' | 'granted' | 'denied'

interface UsePushSubscriptionOptions {
  /** @deprecated El servidor deriva la identidad de la sesión; se ignora. */
  userId?: string
}

interface UsePushSubscriptionReturn {
  permission: PermissionStatus
  isSupported: boolean
  isSubscribed: boolean
  loading: boolean
  error: string | null
  requestPermission: () => Promise<PermissionStatus>
  subscribe: (permissionOverride?: PermissionStatus) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
}

const RECONCILE_SESSION_KEY = 'app-push-reconciled-v1'
const RECONCILE_BACKOFF_KEY = 'app-push-reconcile-failed-at'
const RECONCILE_BACKOFF_MS = 6 * 60 * 60 * 1000 // 6h

// Opt-out explícito: si el miembro DESACTIVÓ notificaciones a propósito,
// ni la auto-recuperación ni el banner deben insistirle.
const OPT_OUT_KEY = 'app-push-optout'

export function isPushOptedOut(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) === '1' } catch { return false }
}

// Varias superficies montan este hook a la vez (UserDropdown, PushReviveBanner)
// y cada instancia tiene su propio useState: si el banner suscribe, el toggle
// del menú se quedaba stale hasta el reload. Un CustomEvent sincroniza todas
// las instancias. Sin riesgo de loops: solo se emite en acciones explícitas
// (subscribe/unsubscribe/self-heal) y el listener solo hace setState.
const PUSH_SYNC_EVENT = 'app-push-subscription-changed'

function broadcastSubscriptionState(subscribed: boolean) {
  try {
    window.dispatchEvent(new CustomEvent(PUSH_SYNC_EVENT, { detail: { subscribed } }))
  } catch {
    /* noop */
  }
}

// pushManager.subscribe + registro en el servidor. Compartido por el flujo
// manual (toggle/banner, con gesto) y la AUTO-RECUPERACIÓN silenciosa
// (cuando el permiso ya está granted, iOS/WebKit NO exige gesto — es el
// mismo privilegio que usa el SW en pushsubscriptionchange).
export async function subscribeAndRegister(reason: string): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('VAPID key no configurada')

  const applicationServerKey = urlBase64ToUint8Array(publicKey)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  })

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        reason,
      },
    }),
  })

  if (!response.ok) {
    const msg = response.status === 401
      ? 'Sesión expirada — vuelve a iniciar sesión'
      : 'Error al guardar suscripción'
    throw new Error(msg)
  }

  return true
}

/** ¿Le toca a este mount hacer la reconciliación de red? (once-per-session + backoff) */
function claimReconcileSlot(): boolean {
  try {
    if (sessionStorage.getItem(RECONCILE_SESSION_KEY)) return false

    const failedAt = Number(localStorage.getItem(RECONCILE_BACKOFF_KEY) || 0)
    if (failedAt && Date.now() - failedAt < RECONCILE_BACKOFF_MS) return false

    sessionStorage.setItem(RECONCILE_SESSION_KEY, '1')
    return true
  } catch {
    return false // storage no disponible (private mode raro) -> solo check local
  }
}

export function usePushSubscription(_options: UsePushSubscriptionOptions = {}): UsePushSubscriptionReturn {
  const [permission, setPermission] = useState<PermissionStatus>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verificar soporte y estado inicial (una vez por mount)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)

    if (!supported) return

    setPermission(Notification.permission)

    // Sincronía entre instancias del hook (banner <-> toggle del menú)
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ subscribed: boolean }>).detail
      if (typeof detail?.subscribed === 'boolean') setIsSubscribed(detail.subscribed)
    }
    window.addEventListener(PUSH_SYNC_EVENT, onSync)

    let cancelled = false

    const check = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (cancelled) return

        if (!subscription) {
          // AUTO-RECUPERACIÓN CERO-TAPS: iOS puede matar la suscripción del
          // navegador (meses sin abrir, batería, etc). Si el permiso YA está
          // granted, re-suscribir NO requiere gesto del usuario — se recupera
          // el canal en silencio. Solo si el miembro NO desactivó a propósito.
          // Guardas anti-loop: once-per-session + backoff 6h (cicatriz enero).
          if (Notification.permission === 'granted' && !isPushOptedOut() && claimReconcileSlot()) {
            console.log('[Push] Permission granted but no browser subscription — auto-recovering...')
            try {
              await subscribeAndRegister('auto-recovery')
              console.log('[Push] Auto-recovery OK: channel restored without user action')
              try { localStorage.removeItem(RECONCILE_BACKOFF_KEY) } catch { /* noop */ }
              if (!cancelled) {
                setIsSubscribed(true)
                broadcastSubscriptionState(true)
              }
            } catch (recoveryErr) {
              // Fallback: queda el banner (tap manual) en la próxima apertura
              console.warn('[Push] Auto-recovery failed:', recoveryErr)
              try { localStorage.setItem(RECONCILE_BACKOFF_KEY, String(Date.now())) } catch { /* noop */ }
              if (!cancelled) setIsSubscribed(false)
            }
            return
          }

          setIsSubscribed(false)
          return
        }

        // Estado local optimista mientras (quizá) reconciliamos
        setIsSubscribed(true)

        if (!claimReconcileSlot()) return

        // Reconciliación: preguntar la verdad a la BD
        const res = await fetch(
          `/api/notifications/status?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { credentials: 'same-origin' }
        )

        if (res.status === 401) return // sin sesión: no hay nada que reconciliar

        if (!res.ok) {
          try { localStorage.setItem(RECONCILE_BACKOFF_KEY, String(Date.now())) } catch { /* noop */ }
          return // fallback: nos quedamos con el estado local
        }

        const { subscribed } = (await res.json()) as { subscribed: boolean }
        if (cancelled || subscribed) {
          try { localStorage.removeItem(RECONCILE_BACKOFF_KEY) } catch { /* noop */ }
          return
        }

        // Zombie detectado: navegador dice sí, BD dice no -> self-heal silencioso
        console.log('[Push] Zombie subscription detected, self-healing...')
        const healRes = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              reason: 'reconcile-self-heal',
            },
          }),
        })

        if (cancelled) return

        if (healRes.ok) {
          console.log('[Push] Self-heal OK: subscription restored in DB')
          try { localStorage.removeItem(RECONCILE_BACKOFF_KEY) } catch { /* noop */ }
          setIsSubscribed(true)
          broadcastSubscriptionState(true)
        } else {
          console.warn('[Push] Self-heal failed:', healRes.status)
          try { localStorage.setItem(RECONCILE_BACKOFF_KEY, String(Date.now())) } catch { /* noop */ }
          // La verdad: no está suscrito en la BD -> el toggle debe decir "Activar"
          setIsSubscribed(false)
          broadcastSubscriptionState(false)
        }
      } catch (err) {
        console.error('[Push] Error checking subscription:', err)
      }
    }

    check()

    return () => {
      cancelled = true
      window.removeEventListener(PUSH_SYNC_EVENT, onSync)
    }
  }, [])

  // Solicitar permisos
  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!isSupported) {
      setError('Notificaciones no soportadas')
      return 'denied'
    }

    try {
      setLoading(true)
      setError(null)

      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'denied') {
        setError('Permisos denegados')
      }

      return result
    } catch (err) {
      console.error('[Push] Error requesting permission:', err)
      setError('Error al solicitar permisos')
      return 'denied'
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  // Suscribirse a push notifications
  const subscribe = useCallback(async (permissionOverride?: PermissionStatus): Promise<boolean> => {
    if (!isSupported) {
      setError('Notificaciones no soportadas')
      return false
    }

    // Use override if provided (fixes stale state issue)
    const effectivePermission = permissionOverride || permission
    if (effectivePermission !== 'granted') {
      setError('Se requieren permisos')
      return false
    }

    try {
      setLoading(true)
      setError(null)

      await subscribeAndRegister('user-action')

      // Suscripción explícita: limpiar el opt-out para que la
      // auto-recuperación vuelva a cuidar este canal
      try { localStorage.removeItem(OPT_OUT_KEY) } catch { /* noop */ }

      setIsSubscribed(true)
      broadcastSubscriptionState(true)
      console.log('[Push] Suscrito exitosamente')
      return true

    } catch (err) {
      console.error('[Push] Error subscribing:', err)
      setError(err instanceof Error ? err.message : 'Error al suscribirse')
      setIsSubscribed(false)
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported, permission])

  // Desuscribirse
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        const response = await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        if (!response.ok) {
          // El navegador ya se desuscribió (el push dejará de llegar igual),
          // pero avisamos que el servidor no confirmó la baja.
          console.warn('[Push] Server unsubscribe failed:', response.status)
        }
      }

      // Opt-out explícito: la auto-recuperación NO debe revivir este canal
      try { localStorage.setItem(OPT_OUT_KEY, '1') } catch { /* noop */ }

      setIsSubscribed(false)
      broadcastSubscriptionState(false)
      console.log('[Push] Desuscrito exitosamente')
      return true

    } catch (err) {
      console.error('[Push] Error unsubscribing:', err)
      setError(err instanceof Error ? err.message : 'Error al desuscribirse')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    permission,
    isSupported,
    isSubscribed,
    loading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
  }
}

// Convierte VAPID key base64 URL a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
