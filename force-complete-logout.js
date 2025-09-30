// Complete browser authentication cleanup
console.log('🧹 Starting COMPLETE browser authentication cleanup...');

// Step 1: Clear logout flag to test if MSAL is the issue
localStorage.removeItem('justLoggedOut');
console.log('✅ Removed justLoggedOut flag');

// Step 2: Clear ALL localStorage
const allLocalStorageKeys = Object.keys(localStorage);
allLocalStorageKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`🗑️ Removed localStorage: ${key}`);
});

// Step 3: Clear ALL sessionStorage
sessionStorage.clear();
console.log('🗑️ Cleared all sessionStorage');

// Step 4: Clear ALL cookies
document.cookie.split(";").forEach(function(c) {
  const eqPos = c.indexOf("=");
  const name = eqPos > -1 ? c.substr(0, eqPos) : c;
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  console.log(`🍪 Cleared cookie: ${name.trim()}`);
});

// Step 5: Clear indexedDB (where MSAL might store data)
if ('indexedDB' in window) {
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      console.log(`🗃️ Found IndexedDB: ${db.name}`);
      if (db.name && (db.name.includes('msal') || db.name.includes('auth'))) {
        const deleteReq = indexedDB.deleteDatabase(db.name);
        deleteReq.onsuccess = () => console.log(`✅ Deleted IndexedDB: ${db.name}`);
        deleteReq.onerror = () => console.log(`❌ Failed to delete IndexedDB: ${db.name}`);
      }
    });
  }).catch(e => console.log('IndexedDB check failed:', e));
}

// Step 6: Clear service workers (if any)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('🧹 Unregistered service worker');
    });
  });
}

// Step 7: Clear any other browser storage
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.delete(name);
      console.log(`🗑️ Cleared cache: ${name}`);
    });
  });
}

console.log('✅ Complete browser cleanup finished!');
console.log('🔄 Reloading page in 2 seconds...');

setTimeout(() => {
  window.location.replace(window.location.origin);
}, 2000);