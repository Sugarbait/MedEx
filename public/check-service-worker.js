// Diagnostic script to check service worker status
// Run this in browser console: fetch('/check-service-worker.js').then(r => r.text()).then(eval)

console.log('=== SERVICE WORKER DIAGNOSTIC ===');

// Check if service worker is registered
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('Service Worker Registrations:', registrations.length);
    registrations.forEach((registration, index) => {
      console.log(`Registration ${index}:`, {
        scope: registration.scope,
        active: registration.active?.state,
        waiting: registration.waiting?.state,
        installing: registration.installing?.state
      });
    });

    if (registrations.length > 0) {
      console.log('⚠️ SERVICE WORKER IS ACTIVE - This may cache old code!');
      console.log('To unregister all service workers, run:');
      console.log('navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))');
    }
  });
}

// Check cache storage
if ('caches' in window) {
  caches.keys().then(keys => {
    console.log('Cache Storage Keys:', keys);
    if (keys.length > 0) {
      console.log('⚠️ CACHES EXIST - May serve old content!');
      console.log('To clear all caches, run:');
      console.log('caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))');
    }
  });
}

// Check current page URL
console.log('Current URL:', window.location.href);
console.log('Expected dev server: http://localhost:3002');

// Check if loading from service worker
console.log('Loading from service worker?', navigator.serviceWorker.controller ? 'YES' : 'NO');
