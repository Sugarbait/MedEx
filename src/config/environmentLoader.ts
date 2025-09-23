// Azure Static Web Apps Environment Variable Loader
// This module handles environment variable loading for Azure deployments
// where standard Vite env loading might fail

interface EnvironmentConfig {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  supabaseServiceRoleKey: string | null
  azureClientId: string | null
  azureTenantId: string | null
  hipaaMode: string | null
  openaiApiKey: string | null
}

// Azure Static Web Apps may inject environment variables differently
// This function tries multiple approaches to load them
function loadEnvironmentVariables(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    supabaseUrl: null,
    supabaseAnonKey: null,
    supabaseServiceRoleKey: null,
    azureClientId: null,
    azureTenantId: null,
    hipaaMode: null,
    openaiApiKey: null
  }

  // Method 1: Vite-defined globals (build-time injection)
  try {
    if (typeof __VITE_SUPABASE_URL__ !== 'undefined' && __VITE_SUPABASE_URL__) {
      config.supabaseUrl = __VITE_SUPABASE_URL__
    }
    if (typeof __VITE_SUPABASE_ANON_KEY__ !== 'undefined' && __VITE_SUPABASE_ANON_KEY__) {
      config.supabaseAnonKey = __VITE_SUPABASE_ANON_KEY__
    }
    if (typeof __VITE_SUPABASE_SERVICE_ROLE_KEY__ !== 'undefined' && __VITE_SUPABASE_SERVICE_ROLE_KEY__) {
      config.supabaseServiceRoleKey = __VITE_SUPABASE_SERVICE_ROLE_KEY__
    }
    if (typeof __VITE_AZURE_CLIENT_ID__ !== 'undefined' && __VITE_AZURE_CLIENT_ID__) {
      config.azureClientId = __VITE_AZURE_CLIENT_ID__
    }
    if (typeof __VITE_AZURE_TENANT_ID__ !== 'undefined' && __VITE_AZURE_TENANT_ID__) {
      config.azureTenantId = __VITE_AZURE_TENANT_ID__
    }
    if (typeof __VITE_HIPAA_MODE__ !== 'undefined' && __VITE_HIPAA_MODE__) {
      config.hipaaMode = __VITE_HIPAA_MODE__
    }
  } catch (error) {
    // Globals not available, continue with other methods
  }

  // Method 2: Standard Vite import.meta.env
  try {
    const env = import.meta.env
    if (env) {
      config.supabaseUrl = config.supabaseUrl || env.VITE_SUPABASE_URL || null
      config.supabaseAnonKey = config.supabaseAnonKey || env.VITE_SUPABASE_ANON_KEY || null
      config.supabaseServiceRoleKey = config.supabaseServiceRoleKey || env.VITE_SUPABASE_SERVICE_ROLE_KEY || null
      config.azureClientId = config.azureClientId || env.VITE_AZURE_CLIENT_ID || null
      config.azureTenantId = config.azureTenantId || env.VITE_AZURE_TENANT_ID || null
      config.hipaaMode = config.hipaaMode || env.VITE_HIPAA_MODE || null
      config.openaiApiKey = config.openaiApiKey || env.VITE_OPENAI_API_KEY || null
    }
  } catch (error) {
    // import.meta.env not available, continue
  }

  // Method 3: Azure Static Web Apps specific environment loading
  // Azure sometimes injects environment variables into window object
  try {
    const windowEnv = (window as any).__env__
    if (windowEnv) {
      config.supabaseUrl = config.supabaseUrl || windowEnv.VITE_SUPABASE_URL || null
      config.supabaseAnonKey = config.supabaseAnonKey || windowEnv.VITE_SUPABASE_ANON_KEY || null
      config.supabaseServiceRoleKey = config.supabaseServiceRoleKey || windowEnv.VITE_SUPABASE_SERVICE_ROLE_KEY || null
      config.azureClientId = config.azureClientId || windowEnv.VITE_AZURE_CLIENT_ID || null
      config.azureTenantId = config.azureTenantId || windowEnv.VITE_AZURE_TENANT_ID || null
      config.hipaaMode = config.hipaaMode || windowEnv.VITE_HIPAA_MODE || null
    }
  } catch (error) {
    // Window env not available, continue
  }

  // Method 4: Runtime configuration API (for Azure Static Web Apps)
  // This would be loaded asynchronously, but we'll handle that separately

  // Method 5: Fallback to environment-specific defaults
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const isAzureProduction = window.location.hostname.includes('azurestaticapps.net') ||
                           window.location.hostname.includes('nexasync.ca')

  if (isLocalhost || isAzureProduction) {
    // Provide actual credentials for both development and Azure production
    config.supabaseUrl = config.supabaseUrl || 'https://cpkslvmydfdevdftieck.supabase.co'
    config.supabaseAnonKey = config.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'
    config.supabaseServiceRoleKey = config.supabaseServiceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'
    config.azureClientId = config.azureClientId || '12345678-1234-1234-1234-123456789012'
    config.azureTenantId = config.azureTenantId || '87654321-4321-4321-4321-210987654321'
    config.hipaaMode = config.hipaaMode || 'true'
  }

  return config
}

// Load configuration immediately
export const environmentConfig = loadEnvironmentVariables()

// Debug logging for troubleshooting
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const isAzureProduction = window.location.hostname.includes('azurestaticapps.net') ||
                         window.location.hostname.includes('nexasync.ca')

if (isDev || isAzureProduction || !sessionStorage.getItem('env-config-logged')) {
  console.log('🔧 Environment Configuration Loaded:', {
    supabaseUrl: environmentConfig.supabaseUrl ? '✅ configured' : '❌ missing',
    supabaseAnonKey: environmentConfig.supabaseAnonKey ? '✅ configured' : '❌ missing',
    azureClientId: environmentConfig.azureClientId ? '✅ configured' : '❌ missing',
    azureTenantId: environmentConfig.azureTenantId ? '✅ configured' : '❌ missing',
    hostname: window.location.hostname,
    method: 'environmentLoader',
    usingFallback: (isDev || isAzureProduction) ? 'yes - hardcoded credentials' : 'no'
  })
  if (!isDev) {
    sessionStorage.setItem('env-config-logged', 'true')
  }
}