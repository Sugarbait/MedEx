// Azure Static Web Apps Environment Variable Injection Script
// This script should be included in the HTML head to inject environment variables
// Available as window.__env__ for runtime access

(function() {
  'use strict';

  // Create environment object on window
  window.__env__ = window.__env__ || {};

  // Function to safely get environment variables from various sources
  function getEnvVar(name) {
    // Try process.env first (Node.js build time)
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }

    // Try Azure Static Web Apps environment
    if (typeof window !== 'undefined' && window.staticWebAppConfig && window.staticWebAppConfig[name]) {
      return window.staticWebAppConfig[name];
    }

    // Try meta tags (injected by Azure)
    try {
      const metaTag = document.querySelector(`meta[name="${name}"]`);
      if (metaTag && metaTag.getAttribute('content')) {
        return metaTag.getAttribute('content');
      }
    } catch (e) {
      // Meta tag not found
    }

    return null;
  }

  // Set environment variables
  window.__env__.VITE_SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
  window.__env__.VITE_SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');
  window.__env__.VITE_SUPABASE_SERVICE_ROLE_KEY = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');
  window.__env__.VITE_AZURE_CLIENT_ID = getEnvVar('VITE_AZURE_CLIENT_ID');
  window.__env__.VITE_AZURE_TENANT_ID = getEnvVar('VITE_AZURE_TENANT_ID');
  window.__env__.VITE_HIPAA_MODE = getEnvVar('VITE_HIPAA_MODE');
  window.__env__.VITE_OPENAI_API_KEY = getEnvVar('VITE_OPENAI_API_KEY');

  // Azure Static Web Apps fallback - provide credentials for production domains
  const isAzureProduction = window.location.hostname.includes('azurestaticapps.net') ||
                           window.location.hostname.includes('nexasync.ca');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if ((isLocalhost || isAzureProduction) && !window.__env__.VITE_SUPABASE_URL) {
    // Fallback credentials for Azure production and development
    window.__env__.VITE_SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co';
    window.__env__.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE';
    window.__env__.VITE_SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0';
    window.__env__.VITE_AZURE_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
    window.__env__.VITE_AZURE_TENANT_ID = '87654321-4321-4321-4321-210987654321';
    window.__env__.VITE_HIPAA_MODE = 'true';
  }

  // Debug logging
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('azurestaticapps')) {
    console.log('🔧 Azure Environment Injection:', {
      supabaseUrl: window.__env__.VITE_SUPABASE_URL ? '✅ configured' : '❌ missing',
      supabaseAnonKey: window.__env__.VITE_SUPABASE_ANON_KEY ? '✅ configured' : '❌ missing',
      azureClientId: window.__env__.VITE_AZURE_CLIENT_ID ? '✅ configured' : '❌ missing',
      method: 'azure-env-inject'
    });
  }
})();