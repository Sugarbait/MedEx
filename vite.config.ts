import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    // Plugin to copy Azure Static Web Apps files
    {
      name: 'copy-azure-files',
      generateBundle() {
        // Copy staticwebapp.config.json to dist
        try {
          copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json')
          console.log('✅ Copied staticwebapp.config.json to dist/')
        } catch (error) {
          console.warn('⚠️ Failed to copy staticwebapp.config.json:', error)
        }

        // Copy 404.html to dist
        try {
          copyFileSync('404.html', 'dist/404.html')
          console.log('✅ Copied 404.html to dist/')
        } catch (error) {
          console.warn('⚠️ Failed to copy 404.html:', error)
        }
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'CareXPS Healthcare CRM',
        short_name: 'CareXPS',
        description: 'HIPAA-compliant healthcare CRM with Retell AI integration',
        theme_color: '#0056B3',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.retellai\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'retell-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Large third-party libraries get their own chunks
          if (id.includes('html2canvas')) {
            return 'html2canvas'
          }
          // All other node_modules go into vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          // Everything else stays in main chunk
          return undefined
        }
      }
    }
  },
  server: {
    port: 3000,
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  }
})