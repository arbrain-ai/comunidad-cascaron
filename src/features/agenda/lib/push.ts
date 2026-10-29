/**
 * ACTIVAR PUSH EN EL MOMENTO CORRECTO.
 *
 * La mayoria de los miembros no tiene push activado. Si el recordatorio saliera
 * solo por push dando por hecho que todos lo tienen, casi nadie se enteraria. Y no se pide al aterrizar (ahi se
 * niega): se pide EXACTAMENTE cuando el miembro acaba de pulsar "Recordarme",
 * que es el unico instante en que el permiso tiene sentido para el.
 *
 * Reusa `subscribeAndRegister` de features/notifications: no reconstruimos el
 * pipeline de push, lo cableamos.
 */
import { subscribeAndRegister } from '@/features/notifications/hooks/usePushSubscription';

export type ResultadoPush = 'ya_activo' | 'activado' | 'denegado' | 'no_soportado' | 'error';

export async function asegurarPush(_userId: string): Promise<ResultadoPush> {
  if (typeof window === 'undefined') return 'no_soportado';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'no_soportado';

  try {
    const reg = await navigator.serviceWorker.ready;
    const yaHay = await reg.pushManager.getSubscription();
    if (yaHay && Notification.permission === 'granted') return 'ya_activo';

    // Estamos dentro del click de "Recordarme": hay gesto de usuario, que es
    // lo que iOS/WebKit exige para conceder el permiso.
    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return 'denegado';

    await subscribeAndRegister('recordatorio-de-clase');
    return 'activado';
  } catch {
    return 'error';
  }
}
