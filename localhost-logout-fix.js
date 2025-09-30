// Localhost-specific logout fix for MSAL
console.log('🔧 LOCALHOST LOGOUT FIX - Clearing Microsoft Auth Session...');

// Step 1: Clear justLoggedOut flag first
localStorage.removeItem('justLoggedOut');
console.log('✅ Cleared justLoggedOut flag');

// Step 2: Clear ALL Microsoft authentication cookies (the key issue on localhost)
const microsoftDomains = [
  'login.microsoftonline.com',
  'login.live.com',
  'account.live.com',
  'login.windows.net',
  '.microsoftonline.com',
  '.live.com',
  '.microsoft.com'
];

// Clear all cookies including Microsoft domains
document.cookie.split(";").forEach(function(c) {
  const eqPos = c.indexOf("=");
  const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();

  // Clear for current domain
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;

  // Try to clear for Microsoft domains (won't work due to CORS but worth trying)
  microsoftDomains.forEach(domain => {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + domain;
  });

  console.log(`🍪 Cleared cookie: ${name}`);
});

// Step 3: Clear ALL localStorage and sessionStorage
Object.keys(localStorage).forEach(key => {
  localStorage.removeItem(key);
  console.log(`🗑️ localStorage: ${key}`);
});

sessionStorage.clear();
console.log('🗑️ Cleared all sessionStorage');

// Step 4: Clear IndexedDB
if ('indexedDB' in window) {
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      if (db.name) {
        const deleteReq = indexedDB.deleteDatabase(db.name);
        deleteReq.onsuccess = () => console.log(`✅ Deleted IndexedDB: ${db.name}`);
        deleteReq.onerror = () => console.log(`❌ Failed to delete IndexedDB: ${db.name}`);
      }
    });
  }).catch(e => console.log('IndexedDB cleanup failed:', e));
}

// Step 5: Open Microsoft logout URL in hidden iframe to clear server session
console.log('🌐 Attempting to clear Microsoft server session...');

const logoutUrls = [
  'https://login.microsoftonline.com/common/oauth2/logout',
  'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
  'https://login.live.com/logout.srf'
];

logoutUrls.forEach((url, index) => {
  setTimeout(() => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      console.log(`✅ Microsoft logout attempt ${index + 1} completed`);
    }, 1000);
  }, index * 500);
});

console.log('✅ Localhost logout cleanup completed!');
console.log('🔄 Reloading in 4 seconds to allow Microsoft logout to complete...');

setTimeout(() => {
  window.location.replace(window.location.origin + '?_nocache=' + Date.now());
}, 4000);