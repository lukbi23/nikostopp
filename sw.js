// Minimaler Service Worker für die PWA-Funktionalität
self.addEventListener('fetch', (event) => {
  // Leitet Netzwerkanfragen vorerst direkt an das Netzwerk weiter
  event.respondWith(fetch(event.request));
});