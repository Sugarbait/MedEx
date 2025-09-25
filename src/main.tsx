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

// Emergency TOTP fix utility disabled - MFA now works properly via database

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

// IMMEDIATE API KEY SETUP - Load keys before React even starts
const setupApiKeysImmediately = () => {
  console.log('🚀 IMMEDIATE: Setting up API keys before React initialization...')

  // Set up the user structure that our API loading expects
  const userId = 'dynamic-pierre-user'
  localStorage.setItem('currentUser', JSON.stringify({ id: userId }))

  const apiSettings = {
    theme: 'light',
    mfaEnabled: false,
    refreshInterval: 30000,
    sessionTimeout: 15,
    notifications: { calls: true, sms: true, system: true },
    retellApiKey: 'key_c3f084f5ca67781070e188b47d7f',
    callAgentId: 'agent_447a1b9da540237693b0440df6',
    smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
  }
  localStorage.setItem(`settings_${userId}`, JSON.stringify(apiSettings))
  console.log('✅ IMMEDIATE: API keys set up in localStorage')
}

// Call this immediately, before any React code runs
setupApiKeysImmediately()

// Check if we're in localhost development mode with fake Azure credentials
const isDevMode = window.location.hostname === 'localhost' &&
  (import.meta.env.VITE_AZURE_CLIENT_ID === '12345678-1234-1234-1234-123456789012' ||
   !import.meta.env.VITE_AZURE_CLIENT_ID)

if (isDevMode) {
  console.log('🔧 DEVELOPMENT MODE: Using demo authentication (Azure credentials are placeholder)')
  // Render without MSAL for development demo mode
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  // Production mode with proper Azure authentication
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>,
  )
}