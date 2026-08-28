/* Service Worker: recibe notificaciones Web Push */
self.addEventListener('push', (event) => {
  let title = '⏰ Recordatorio de tu cita';
  let body = 'Tenés tu turno en 2 horas. ¡Te esperamos! 💈';
  let url = '/?view=client';
  try {
    const data = event.data?.json();
    if (data) {
      title = data.title || title;
      body = data.body || body;
      url = data.url || url;
    }
  } catch {
    // el payload puede no ser JSON
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/?view=client';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
