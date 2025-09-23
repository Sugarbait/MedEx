import { Configuration, PublicClientApplication } from '@azure/msal-browser'

// Get environment variables from Vite define or fallback to import.meta.env
const azureClientId = (typeof __VITE_AZURE_CLIENT_ID__ !== 'undefined' ? __VITE_AZURE_CLIENT_ID__ : null)
  || import.meta.env.VITE_AZURE_CLIENT_ID || '12345678-1234-1234-1234-123456789012'
const azureTenantId = (typeof __VITE_AZURE_TENANT_ID__ !== 'undefined' ? __VITE_AZURE_TENANT_ID__ : null)
  || import.meta.env.VITE_AZURE_TENANT_ID || '87654321-4321-4321-4321-210987654321'

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
    cacheLocation: 'localStorage', // This configures where your cache will be stored
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