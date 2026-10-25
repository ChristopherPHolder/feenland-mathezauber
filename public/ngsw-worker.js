// Replacement for the Angular service worker that used to be served at this path.
// The app no longer caches itself, so this worker takes over any existing registration,
// removes the old caches and unregisters itself. The next load comes straight from the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(self.registration.unregister());
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name.startsWith('ngsw:')).map((name) => caches.delete(name)),
        ),
      ),
  );
});
