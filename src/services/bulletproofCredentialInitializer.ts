/**
 * Bulletproof Credential Initializer
 *
 * This service orchestrates the initialization of all credential persistence layers
 * to ensure bulletproof availability across all scenarios.
 */

import { getBulletproofCredentials, storeCredentialsEverywhere, initializeCredentialPersistence } from '@/config/retellCredentials'
import { retellService } from './retellService'
import { chatService } from './chatService'
import { cloudCredentialService } from './cloudCredentialService'

export class BulletproofCredentialInitializer {
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * Initialize all bulletproof credential systems
   */
  public async initialize(): Promise<void> {
    // CRITICAL FIX: Don't initialize if user just logged out
    const justLoggedOut = localStorage.getItem('justLoggedOut')
    if (justLoggedOut === 'true') {
      console.log('🛑 BulletproofCredentialInitializer: User just logged out - skipping initialization')
      return
    }

    if (this.initialized) {
      console.log('🔐 BulletproofCredentialInitializer: Already initialized')
      return
    }

    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }

    this.initializationPromise = this.performInitialization()
    await this.initializationPromise
  }

  private async performInitialization(): Promise<void> {
    try {
      // CRITICAL FIX: Double-check logout status before any operations
      const justLoggedOut = localStorage.getItem('justLoggedOut')
      if (justLoggedOut === 'true') {
        console.log('🛑 BulletproofCredentialInitializer: User just logged out - aborting initialization')
        return
      }

      console.log('🚀 BulletproofCredentialInitializer: Starting bulletproof credential initialization...')
      const startTime = Date.now()

      // Step 1: Initialize hardcoded credential persistence
      console.log('📋 Step 1: Initializing hardcoded credential persistence...')
      initializeCredentialPersistence()

      // Step 2: Get bulletproof credentials
      console.log('🔐 Step 2: Loading bulletproof credentials...')
      const bulletproofCreds = getBulletproofCredentials()

      // Step 3: Store credentials in all persistence layers
      console.log('💾 Step 3: Storing credentials in all persistence layers...')
      storeCredentialsEverywhere(bulletproofCreds)

      // Step 4: Initialize cloud storage (non-blocking)
      console.log('☁️ Step 4: Initializing cloud storage...')
      cloudCredentialService.initialize().catch(error => {
        console.warn('⚠️ Cloud storage initialization failed (continuing with local persistence):', error)
      })

      // Step 5: Initialize RetellService with bulletproof credentials
      console.log('📞 Step 5: Initializing RetellService...')
      retellService.forceUpdateCredentials()
      await retellService.loadCredentialsAsync()

      // Step 6: Initialize ChatService with bulletproof credentials
      console.log('💬 Step 6: Initializing ChatService...')
      chatService.forceUpdateCredentials()
      await this.initializeChatService()

      // Step 7: Auto-populate for current user
      console.log('👤 Step 7: Auto-populating credentials for current user...')
      await this.autoPopulateCurrentUser()

      // Step 8: Set up persistence monitoring
      console.log('🔄 Step 8: Setting up persistence monitoring...')
      this.setupPersistenceMonitoring()

      // Step 9: Verify everything is working
      console.log('✅ Step 9: Verifying bulletproof initialization...')
      await this.verifyInitialization()

      const duration = Date.now() - startTime
      console.log(`🎉 BulletproofCredentialInitializer: Initialization completed successfully in ${duration}ms`)

      this.initialized = true
    } catch (error) {
      console.error('❌ BulletproofCredentialInitializer: Initialization failed:', error)

      // Even if initialization fails, try to force bulletproof credentials
      try {
        console.log('🆘 Attempting emergency bulletproof credential setup...')
        retellService.forceUpdateCredentials()
        chatService.forceUpdateCredentials()
      } catch (emergencyError) {
        console.error('❌ Emergency setup also failed:', emergencyError)
      }

      this.initialized = true // Mark as initialized to prevent infinite loops
    } finally {
      this.initializationPromise = null
    }
  }

  /**
   * Initialize ChatService with retry logic
   */
  private async initializeChatService(): Promise<void> {
    try {
      // Try to sync with RetellService first
      await chatService.syncWithRetellService()

      // Verify configuration
      if (!chatService.isConfigured()) {
        console.log('⚠️ ChatService not configured after sync, forcing credentials...')
        chatService.forceUpdateCredentials()
      }
    } catch (error) {
      console.warn('⚠️ ChatService initialization failed, using fallback:', error)
      chatService.forceUpdateCredentials()
    }
  }

  /**
   * Auto-populate credentials for current user
   */
  private async autoPopulateCurrentUser(): Promise<void> {
    try {
      // CRITICAL FIX: Don't auto-populate if user just logged out
      const justLoggedOut = localStorage.getItem('justLoggedOut')
      if (justLoggedOut === 'true') {
        console.log('🛑 BulletproofCredentialInitializer: User just logged out - skipping user auto-population')
        return
      }

      // Check if we have a current user
      const currentUserData = localStorage.getItem('currentUser')
      if (!currentUserData) {
        console.log('ℹ️ No current user found, skipping user-specific setup')
        return
      }

      const currentUser = JSON.parse(currentUserData)
      if (!currentUser.id) {
        console.log('ℹ️ Current user has no ID, skipping user-specific setup')
        return
      }

      console.log('👤 Setting up bulletproof credentials for user:', currentUser.id)

      // Get bulletproof credentials
      const bulletproofCreds = getBulletproofCredentials()

      // Check if user already has settings
      const existingSettings = localStorage.getItem(`settings_${currentUser.id}`)
      let userSettings: any = {}

      if (existingSettings) {
        try {
          userSettings = JSON.parse(existingSettings)
        } catch (error) {
          console.warn('⚠️ Failed to parse existing user settings, using defaults')
        }
      }

      // Auto-populate missing credentials
      const updatedSettings = {
        ...userSettings,
        retellApiKey: userSettings.retellApiKey || bulletproofCreds.apiKey,
        callAgentId: userSettings.callAgentId || bulletproofCreds.callAgentId,
        smsAgentId: userSettings.smsAgentId || bulletproofCreds.smsAgentId,
        // Ensure other required settings exist
        theme: userSettings.theme || 'light',
        refreshInterval: userSettings.refreshInterval || 30000,
        sessionTimeout: userSettings.sessionTimeout || 15,
        notifications: userSettings.notifications || {
          calls: true,
          sms: true,
          system: true
        }
      }

      // Store updated settings
      localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(updatedSettings))

      // Sync to cloud if available
      try {
        await cloudCredentialService.syncUserCredentialsToCloud(currentUser.id, {
          apiKey: updatedSettings.retellApiKey,
          callAgentId: updatedSettings.callAgentId,
          smsAgentId: updatedSettings.smsAgentId
        })
        console.log('✅ User credentials synced to cloud')
      } catch (cloudError) {
        console.warn('⚠️ Cloud sync failed for user credentials (continuing with local):', cloudError)
      }

      console.log('✅ Bulletproof credentials auto-populated for user:', currentUser.id)
    } catch (error) {
      console.error('❌ Failed to auto-populate credentials for current user:', error)
    }
  }

  /**
   * Set up monitoring to maintain persistence
   */
  private setupPersistenceMonitoring(): void {
    try {
      // Monitor for navigation events
      const maintainCredentials = () => {
        // CRITICAL FIX: Don't restore credentials if user just logged out
        const justLoggedOut = localStorage.getItem('justLoggedOut')
        if (justLoggedOut === 'true') {
          console.log('🛑 Persistence monitor: User just logged out - not restoring credentials')
          return
        }

        if (!retellService.isConfigured() || !chatService.isConfigured()) {
          console.log('🔄 Persistence monitor: Credentials lost, restoring...')
          retellService.forceUpdateCredentials()
          chatService.forceUpdateCredentials()
        }
      }

      // Check every 30 seconds
      setInterval(maintainCredentials, 30000)

      // Check on focus events
      window.addEventListener('focus', maintainCredentials)

      // Check on storage events (cross-tab synchronization)
      window.addEventListener('storage', (event) => {
        if (event.key === 'currentUser' || event.key?.startsWith('settings_')) {
          console.log('🔄 Storage event detected, maintaining credentials...')
          setTimeout(maintainCredentials, 100)
        }
      })

      console.log('✅ Persistence monitoring set up successfully')
    } catch (error) {
      console.error('❌ Failed to set up persistence monitoring:', error)
    }
  }

  /**
   * Verify that initialization was successful
   */
  private async verifyInitialization(): Promise<void> {
    const issues: string[] = []

    // Check hardcoded credentials
    try {
      const bulletproofCreds = getBulletproofCredentials()
      if (!bulletproofCreds.apiKey) {
        issues.push('Hardcoded credentials not accessible')
      }
    } catch (error) {
      issues.push('Failed to load hardcoded credentials')
    }

    // Check RetellService
    if (!retellService.isConfigured()) {
      issues.push('RetellService not configured')
    }

    // Check ChatService
    if (!chatService.isConfigured()) {
      issues.push('ChatService not configured')
    }

    // Check storage
    try {
      const sessionBackup = sessionStorage.getItem('retell_credentials_backup')
      if (!sessionBackup) {
        issues.push('SessionStorage backup not found')
      }
    } catch (error) {
      issues.push('SessionStorage check failed')
    }

    if (issues.length > 0) {
      console.warn('⚠️ Verification found issues:', issues)

      // Attempt to fix issues
      console.log('🔧 Attempting to fix verification issues...')
      retellService.forceUpdateCredentials()
      chatService.forceUpdateCredentials()

      const bulletproofCreds = getBulletproofCredentials()
      storeCredentialsEverywhere(bulletproofCreds)
    } else {
      console.log('✅ Verification passed: All systems operational')
    }
  }

  /**
   * Force re-initialization of all systems
   */
  public async forceReinitialize(): Promise<void> {
    console.log('🔄 Forcing bulletproof credential re-initialization...')

    this.initialized = false
    this.initializationPromise = null

    await this.initialize()
  }

  /**
   * Get initialization status
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Emergency credential restoration
   */
  public emergencyRestore(): void {
    console.log('🆘 Emergency credential restoration activated!')

    try {
      // Force bulletproof credentials everywhere
      const bulletproofCreds = getBulletproofCredentials()
      storeCredentialsEverywhere(bulletproofCreds)

      // Force update services
      retellService.forceUpdateCredentials()
      chatService.forceUpdateCredentials()

      // Auto-populate current user
      this.autoPopulateCurrentUser().catch(error => {
        console.warn('Emergency user setup failed:', error)
      })

      console.log('✅ Emergency restoration completed')
    } catch (error) {
      console.error('❌ Emergency restoration failed:', error)
    }
  }

  /**
   * Get comprehensive status report
   */
  public getStatusReport(): any {
    try {
      const bulletproofCreds = getBulletproofCredentials()

      return {
        initialized: this.initialized,
        hardcodedCredentials: {
          available: !!bulletproofCreds.apiKey,
          apiKeyLength: bulletproofCreds.apiKey?.length || 0,
          hasCallAgent: !!bulletproofCreds.callAgentId,
          hasSmsAgent: !!bulletproofCreds.smsAgentId
        },
        services: {
          retellService: {
            configured: retellService.isConfigured(),
            apiKey: !!retellService.getApiKey()
          },
          chatService: {
            configured: chatService.isConfigured(),
            status: chatService.getConfigurationStatus()
          }
        },
        storage: {
          sessionBackup: !!sessionStorage.getItem('retell_credentials_backup'),
          memoryBackup: !!(window as any).__retellCredentialsBackup,
          emergencyBackup: !!localStorage.getItem('__emergencyRetellCredentials')
        },
        cloud: {
          initialized: cloudCredentialService.isAvailable
        },
        currentUser: {
          exists: !!localStorage.getItem('currentUser'),
          hasSettings: (() => {
            try {
              const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
              return currentUser.id ? !!localStorage.getItem(`settings_${currentUser.id}`) : false
            } catch {
              return false
            }
          })()
        }
      }
    } catch (error) {
      return {
        error: 'Failed to generate status report',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton
export const bulletproofCredentialInitializer = new BulletproofCredentialInitializer()

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).bulletproofCredentialInitializer = bulletproofCredentialInitializer

  // Add convenient global functions
  (window as any).initializeBulletproofCredentials = () => bulletproofCredentialInitializer.initialize()
  (window as any).emergencyCredentialRestore = () => bulletproofCredentialInitializer.emergencyRestore()
  (window as any).getCredentialStatus = () => bulletproofCredentialInitializer.getStatusReport()
}