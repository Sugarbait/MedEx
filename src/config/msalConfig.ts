import { Configuration, PublicClientApplication } from '@azure/msal-browser'
import { environmentConfig } from './environmentLoader'

// Use the robust environment loader for Azure credentials
const azureClientId = environmentConfig.azureClientId || '12345678-1234-1234-1234-123456789012'
const azureTenantId = environmentConfig.azureTenantId || '87654321-4321-4321-4321-210987654321'

// For localhost development, use less strict authentication
const isLocalhost = window.location.hostname === 'localhost'

// MSAL configuration
const msalConfig: Configuration = {
  auth: {
    clientId: azureClientId,
    authority: `https://login.microsoftonline.com/${azureTenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: 'sessionStorage', // Changed to sessionStorage for better logout behavior
    storeAuthStateInCookie: false, // Set this to "true" if you're having issues on IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }
        switch (level) {
          case 0: // LogLevel.Error
            console.error('MSAL Error:', message)
            break
          case 1: // LogLevel.Warning
            console.warn('MSAL Warning:', message)
            break
          case 2: // LogLevel.Info
            console.info('MSAL Info:', message)
            break
          case 3: // LogLevel.Verbose
            console.debug('MSAL Verbose:', message)
            break
        }
      }
    }
  }
}

// Create the MSAL instance that you should pass to MsalProvider
export const msalInstance = new PublicClientApplication(msalConfig)

// Login request scopes
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email']
}

// Token request scopes
export const tokenRequest = {
  scopes: ['User.Read']
}

// Log environment check
console.log('🔧 MSAL Configuration:')
console.log('- Client ID:', msalConfig.auth.clientId?.substring(0, 8) + '...')
console.log('- Authority:', msalConfig.auth.authority)
console.log('- Redirect URI:', msalConfig.auth.redirectUri)