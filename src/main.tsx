import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './config/msalConfig'
import App from './App.tsx'
import './index.css'

// CRITICAL FIX: Prevent infinite console logging that crashes the browser
(() => {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  let logCount = 0
  // More aggressive throttling in production
  const MAX_LOGS_PER_SECOND = import.meta.env.DEV ? 100 : 10
  const RESET_INTERVAL = 1000

  const shouldThrottle = () => {
    logCount++
    if (logCount > MAX_LOGS_PER_SECOND) {
      return true
    }
    return false
  }

  // Reset counter every second
  setInterval(() => {
    logCount = 0
  }, RESET_INTERVAL)

  console.log = (...args) => {
    if (!shouldThrottle()) {
      originalLog.apply(console, args)
    }
  }

  console.warn = (...args) => {
    if (!shouldThrottle()) {
      originalWarn.apply(console, args)
    }
  }

  console.error = (...args) => {
    if (!shouldThrottle()) {
      originalError.apply(console, args)
    }
  }
})()

// Import test utilities in development
// Commented out to fix blank page issue
// if (import.meta.env.DEV) {
//   import('./test/notesUuidFixTest')
// }

// Import cross-device sync diagnostic utility
if (import.meta.env.DEV) {
  import('./utils/crossDeviceSyncDiagnostic').catch(() => {
    console.log('Cross-device sync diagnostic not available')
  })
}

// Import emergency access utility (for admin use)
import('./utils/emergencyAccess').catch(() => {
  console.log('Emergency access not available')
})

// Import emergency TOTP fix utility
import('./utils/totpEmergencyFix').catch(() => {
  console.log('TOTP emergency fix not available')
})

// Import super user setup test utility (for development)
if (import.meta.env.DEV) {
  import('./utils/testSuperUserSetup').catch(() => {
    console.log('Super user test utility not available')
  })
  import('./utils/finalSuperUserTest').catch(() => {
    console.log('Final super user test not available')
  })
}

// Register service worker via virtual module
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  }).catch(() => {
    // Fallback for development or if virtual module not available
    console.log('PWA not available')
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>,
)