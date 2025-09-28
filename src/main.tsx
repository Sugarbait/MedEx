console.log('🚀 Starting CareXPS Healthcare CRM...')

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Basic user setup - preserves existing data to prevent avatar loss
try {
  const defaultUser = {
    id: 'dynamic-pierre-user',
    name: 'Pierre Farrell',
    email: 'pierre@phaetonai.com',
    role: 'super_user',
    avatar: 'https://nexasync.ca/images/pierre-avatar.png',
    mfaEnabled: false
  }

  const defaultSettings = {
    theme: 'light',
    mfaEnabled: false,
    refreshInterval: 30000,
    sessionTimeout: 15,
    notifications: { calls: true, sms: true, system: true },
    retellApiKey: 'key_c3f084f5ca67781070e188b47d7f',
    callAgentId: 'agent_447a1b9da540237693b0440df6',
    smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
  }

  // CRITICAL: Preserve existing user data to prevent avatar loss
  const existingUser = localStorage.getItem('currentUser')
  if (existingUser) {
    try {
      const userData = JSON.parse(existingUser)
      // Only update if user doesn't exist or if critical data is missing
      if (userData.id === defaultUser.id) {
        // Merge with existing data, preserving avatar and other custom fields
        let preservedUser = {
          ...defaultUser,
          ...userData, // Existing data takes precedence
          // Ensure role stays super_user for these emails
          role: (userData.email === 'elmfarrell@yahoo.com' || userData.email === 'pierre@phaetonai.com') ? 'super_user' : userData.role
        }

        // ADDITIONAL: If user doesn't have avatar, try to restore from persistent storage
        if (!preservedUser.avatar || preservedUser.avatar === defaultUser.avatar) {
          try {
            const persistentAvatar = localStorage.getItem(`avatar_data_${defaultUser.id}`)
            if (persistentAvatar && persistentAvatar.startsWith('data:image/')) {
              preservedUser.avatar = persistentAvatar
              console.log('🔄 Restored avatar from persistent storage during merge')
            } else {
              // Also check the avatar info storage
              const avatarInfo = localStorage.getItem(`avatar_${defaultUser.id}`)
              if (avatarInfo) {
                try {
                  const parsedAvatarInfo = JSON.parse(avatarInfo)
                  if (parsedAvatarInfo.url) {
                    preservedUser.avatar = parsedAvatarInfo.url
                    console.log('🔄 Restored avatar from avatar info during merge')
                  }
                } catch (avatarParseError) {
                  console.warn('Failed to parse stored avatar info during merge:', avatarParseError)
                }
              }
            }
          } catch (avatarRestoreError) {
            console.warn('Failed to restore avatar during merge:', avatarRestoreError)
          }
        }

        localStorage.setItem('currentUser', JSON.stringify(preservedUser))
        console.log('✅ Preserved existing user data with custom avatar')
      } else {
        console.log('✅ Different user found, keeping existing data')
      }
    } catch (parseError) {
      // If parsing fails, use default
      localStorage.setItem('currentUser', JSON.stringify(defaultUser))
      console.log('✅ Reset corrupted user data')
    }
  } else {
    // No existing user, create new but check for preserved avatar
    let userToCreate = { ...defaultUser }

    // CRITICAL: Check for preserved avatar data from previous login
    try {
      const preservedAvatar = localStorage.getItem(`avatar_data_${defaultUser.id}`)
      if (preservedAvatar && preservedAvatar.startsWith('data:image/')) {
        userToCreate.avatar = preservedAvatar
        console.log('🔄 Restored preserved avatar from previous session')
      } else {
        // Also check the avatar info storage
        const avatarInfo = localStorage.getItem(`avatar_${defaultUser.id}`)
        if (avatarInfo) {
          try {
            const parsedAvatarInfo = JSON.parse(avatarInfo)
            if (parsedAvatarInfo.url) {
              userToCreate.avatar = parsedAvatarInfo.url
              console.log('🔄 Restored avatar from avatar info storage')
            }
          } catch (avatarParseError) {
            console.warn('Failed to parse stored avatar info:', avatarParseError)
          }
        }
      }
    } catch (avatarRestoreError) {
      console.warn('Failed to restore preserved avatar:', avatarRestoreError)
    }

    // CRITICAL FIX: Check if user just logged out before auto-creating user
    const justLoggedOut = localStorage.getItem('justLoggedOut')
    if (justLoggedOut !== 'true') {
      localStorage.setItem('currentUser', JSON.stringify(userToCreate))
      console.log('✅ Created new user data with restored avatar')
    } else {
      console.log('🛑 User just logged out - not auto-creating user')
    }
  }

  // Handle settings similarly - preserve existing settings
  // CRITICAL FIX: Don't create settings if user just logged out
  const justLoggedOut = localStorage.getItem('justLoggedOut')
  if (justLoggedOut !== 'true') {
    const existingSettings = localStorage.getItem(`settings_${defaultUser.id}`)
    if (!existingSettings) {
      localStorage.setItem(`settings_${defaultUser.id}`, JSON.stringify(defaultSettings))
      console.log('✅ Created default settings')
    } else {
      console.log('✅ Preserved existing settings')
    }
  } else {
    console.log('🛑 User just logged out - not creating settings')
  }

  console.log('✅ Basic user setup completed')
} catch (error) {
  console.error('❌ Basic setup failed:', error)
}

// Simple loading component
const LoadingApp: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
        <span className="text-white text-2xl">🏥</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">CareXPS Healthcare CRM</h1>
      <p className="text-gray-600">Loading healthcare application...</p>
      <div className="mt-4 text-sm text-gray-500">
        Initializing HIPAA-compliant environment
      </div>
    </div>
  </div>
)

// Main App Component that loads progressively
const MainApp: React.FC = () => {
  const [appLoaded, setAppLoaded] = React.useState(false)
  const [App, setApp] = React.useState<React.ComponentType | null>(null)

  React.useEffect(() => {
    console.log('📱 Loading main App component...')

    // Initialize critical Azure authentication fixes immediately
    Promise.allSettled([
      import('./services/authFlowEnhancer').then(({ authFlowEnhancer }) => {
        authFlowEnhancer.initialize()
        console.log('🔧 Auth flow enhancer started early')
      }).catch(() => console.log('Early auth flow enhancer init failed')),
      import('./utils/azureAuthFix').then(() => {
        console.log('🔧 Azure auth fix started early')
      }).catch(() => console.log('Early Azure auth fix init failed'))
    ]).then(() => {
      console.log('✅ Critical auth fixes initialized')
    })

    // Load the App component dynamically
    import('./App.tsx')
      .then((module) => {
        console.log('✅ App component loaded successfully')
        setApp(() => module.default)
        setAppLoaded(true)
      })
      .catch((error) => {
        console.error('❌ Failed to load App component:', error)
        // Show error state
        setApp(() => () => (
          <div className="min-h-screen bg-red-50 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-800 mb-2">Loading Error</h1>
              <p className="text-red-600">Failed to load application</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Retry
              </button>
            </div>
          </div>
        ))
        setAppLoaded(true)
      })
  }, [])

  if (!appLoaded || !App) {
    return <LoadingApp />
  }

  return <App />
}

// Background initialization - runs after app loads
setTimeout(() => {
  console.log('🔧 Starting background initialization...')

  Promise.allSettled([
    // import('./utils/clearCorruptedMfaData').catch(() => console.log('MFA cleanup skipped')), // DISABLED: Was clearing MFA data on every load
    import('./services/globalServiceInitializer').then(({ globalServiceInitializer }) =>
      globalServiceInitializer.initialize()
    ).catch(() => console.log('Global service init skipped')),
    import('./services/bulletproofCredentialInitializer').then(({ bulletproofCredentialInitializer }) =>
      bulletproofCredentialInitializer.initialize()
    ).catch(() => console.log('Bulletproof credentials skipped')),
    // Initialize Azure authentication fixes for login loop issues
    import('./services/authFlowEnhancer').then(({ authFlowEnhancer }) =>
      authFlowEnhancer.initialize()
    ).catch(() => console.log('Auth flow enhancer init skipped')),
    import('./utils/azureAuthFix').then(() =>
      console.log('✅ Azure auth fix initialized')
    ).catch(() => console.log('Azure auth fix init skipped'))
  ]).then(() => {
    console.log('✅ Background initialization completed')
  })
}, 5000)

// Mount the application
console.log('🚀 Mounting React application...')

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MainApp />
    </React.StrictMode>
  )
  console.log('✅ React application mounted successfully')
} else {
  console.error('❌ Root element not found!')
}