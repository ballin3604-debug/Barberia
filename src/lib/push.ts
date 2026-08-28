import { getSupabase } from './supabase';

/**
 * Suscripción del cliente a notificaciones del navegador (Web Push / VAPID).
 * Devuelve el resultado para mostrar un mensaje elegante.
 */
export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error';

const getVapidPublicKey = (): string | null =>
  import.meta.env.VITE_VAPID_PUBLIC_KEY || null;

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

export const subscribeClientToPush = async (clientId: string): Promise<PushResult> => {
  const publicKey = getVapidPublicKey();
  if (
    !publicKey ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const keys = subscription.toJSON().keys as { p256dh: string; auth: string } | undefined;
    if (!keys) return 'error';

    await getSupabase()
      .from('push_tokens')
      .upsert(
        {
          client_id: clientId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: 'endpoint' },
      );
    return 'granted';
  } catch {
    return 'error';
  }
};
