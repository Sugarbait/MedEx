// Environment variable type declarations for Azure Static Web Apps
declare global {
  // Vite-defined environment variables for Azure Static Web Apps
  const __VITE_SUPABASE_URL__: string | undefined
  const __VITE_SUPABASE_ANON_KEY__: string | undefined
  const __VITE_SUPABASE_SERVICE_ROLE_KEY__: string | undefined
  const __VITE_AZURE_CLIENT_ID__: string | undefined
  const __VITE_AZURE_TENANT_ID__: string | undefined
  const __VITE_HIPAA_MODE__: string | undefined
}

export {}