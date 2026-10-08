self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const options = {
    body: d.body || 'اعلان جدید',
    icon: '/mizan/favicon.ico',
    tag: d.tag || 'mizan-' + Date.now(),
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: d.url || '/mizan/' },
  };
  e.waitUntil(self.registration.showNotification(d.title || 'میزان | MIZAN', options));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/mizan/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) if (c.url.includes('/mizan/')) return c.focus();
    return self.clients.openWindow(url);
  }));
});
