/**
 * Audit User Lookup Service
 *
 * Specialized service for resolving user information in audit logs
 * Provides multiple lookup strategies while maintaining HIPAA compliance
 */

import { supabase } from '@/config/supabase'

export interface UserLookupResult {
  success: boolean
  displayName?: string
  source: 'cache' | 'localStorage' | 'supabase' | 'fallback'
  cached?: boolean
}

class AuditUserLookupService {
  private userCache = new Map<string, string>()
  private cacheExpiry = new Map<string, number>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Primary user lookup method with multiple fallback strategies
   */
  async lookupUser(userId: string, userRole?: string): Promise<UserLookupResult> {
    if (!userId) {
      return {
        success: false,
        displayName: userRole === 'super_user' ? 'Admin User' : 'Unknown User',
        source: 'fallback'
      }
    }

    // Strategy 1: Check cache first
    const cachedResult = this.getCachedUser(userId)
    if (cachedResult.success) {
      return cachedResult
    }

    // Strategy 2: Check current user in localStorage
    const currentUserResult = this.lookupCurrentUser(userId)
    if (currentUserResult.success) {
      this.cacheUser(userId, currentUserResult.displayName!)
      return currentUserResult
    }

    // Strategy 3: Check all localStorage settings and profiles
    const localStorageResult = this.lookupFromLocalStorage(userId)
    if (localStorageResult.success) {
      this.cacheUser(userId, localStorageResult.displayName!)
      return localStorageResult
    }

    // Strategy 4: Try Supabase lookup (if available)
    const supabaseResult = await this.lookupFromSupabase(userId)
    if (supabaseResult.success) {
      this.cacheUser(userId, supabaseResult.displayName!)
      return supabaseResult
    }

    // Strategy 5: Fallback to intelligent user ID processing
    const fallbackResult = this.createIntelligentFallback(userId, userRole)
    this.cacheUser(userId, fallbackResult.displayName!)
    return fallbackResult
  }

  /**
   * Check if user is in cache and not expired
   */
  private getCachedUser(userId: string): UserLookupResult {
    const cached = this.userCache.get(userId)
    const expiry = this.cacheExpiry.get(userId)

    if (cached && expiry && Date.now() < expiry) {
      return {
        success: true,
        displayName: cached,
        source: 'cache',
        cached: true
      }
    }

    // Clean up expired cache entry
    if (cached && expiry && Date.now() >= expiry) {
      this.userCache.delete(userId)
      this.cacheExpiry.delete(userId)
    }

    return { success: false, source: 'cache' }
  }

  /**
   * Look up user from current user data
   */
  private lookupCurrentUser(userId: string): UserLookupResult {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (!currentUser) return { success: false, source: 'localStorage' }

      const user = JSON.parse(currentUser)
      if (user.id === userId || user.user_id === userId) {
        const displayName = this.extractBestDisplayName(user)
        console.log(`👤 Found user in currentUser: ${displayName}`)
        return {
          success: true,
          displayName,
          source: 'localStorage'
        }
      }
    } catch (error) {
      console.warn('Error looking up current user:', error)
    }

    return { success: false, source: 'localStorage' }
  }

  /**
   * Look up user from all localStorage data
   */
  private lookupFromLocalStorage(userId: string): UserLookupResult {
    try {
      const allKeys = Object.keys(localStorage)

      // Check settings and user data keys
      for (const key of allKeys) {
        if (key.startsWith('settings_') ||
            key.startsWith('user_') ||
            key.startsWith('profile_') ||
            key === 'systemUsers') {

          try {
            const data = localStorage.getItem(key)
            if (!data) continue

            const parsedData = JSON.parse(data)

            // Handle arrays (like systemUsers)
            if (Array.isArray(parsedData)) {
              const foundUser = parsedData.find((u: any) =>
                u.id === userId || u.user_id === userId
              )
              if (foundUser) {
                const displayName = this.extractBestDisplayName(foundUser)
                console.log(`👤 Found user in ${key}: ${displayName}`)
                return {
                  success: true,
                  displayName,
                  source: 'localStorage'
                }
              }
            } else {
              // Handle individual objects
              if (parsedData.id === userId || parsedData.user_id === userId) {
                const displayName = this.extractBestDisplayName(parsedData)
                console.log(`👤 Found user in ${key}: ${displayName}`)
                return {
                  success: true,
                  displayName,
                  source: 'localStorage'
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue
          }
        }
      }
    } catch (error) {
      console.warn('Error looking up user from localStorage:', error)
    }

    return { success: false, source: 'localStorage' }
  }

  /**
   * Look up user from Supabase (if available)
   */
  private async lookupFromSupabase(userId: string): Promise<UserLookupResult> {
    try {
      if (!supabase || typeof supabase.from !== 'function') {
        return { success: false, source: 'supabase' }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, username, display_name')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Supabase user lookup failed:', error.message)
        return { success: false, source: 'supabase' }
      }

      if (data) {
        const displayName = this.extractBestDisplayName(data)
        console.log(`👤 Found user in Supabase: ${displayName}`)
        return {
          success: true,
          displayName,
          source: 'supabase'
        }
      }
    } catch (error) {
      console.warn('Error looking up user from Supabase:', error)
    }

    return { success: false, source: 'supabase' }
  }

  /**
   * Create intelligent fallback display name
   */
  private createIntelligentFallback(userId: string, userRole?: string): UserLookupResult {
    let displayName: string

    // Check if userId looks like an email
    if (userId.includes('@')) {
      const emailParts = userId.split('@')
      displayName = emailParts[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      console.log(`📧 Using email-based name: ${displayName}`)
    }
    // Check if userId contains readable information
    else if (userId.includes('_') || userId.includes('-')) {
      displayName = userId.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      console.log(`🔧 Using processed userId: ${displayName}`)
    }
    // Role-based fallback
    else if (userRole) {
      switch (userRole.toLowerCase()) {
        case 'super_user':
        case 'admin':
          displayName = 'Admin User'
          break
        case 'compliance_officer':
          displayName = 'Compliance Officer'
          break
        case 'system_admin':
          displayName = 'System Admin'
          break
        default:
          displayName = `User ${userId.substring(0, 8)}`
      }
      console.log(`👨‍💼 Using role-based name: ${displayName}`)
    }
    // Last resort
    else {
      const shortId = userId.substring(0, 8)
      displayName = shortId.toLowerCase() === 'user' ? 'Admin User' : `User ${shortId}`
      console.log(`🆔 Using ID-based fallback: ${displayName}`)
    }

    return {
      success: true,
      displayName,
      source: 'fallback'
    }
  }

  /**
   * Extract the best display name from user object
   */
  private extractBestDisplayName(user: any): string {
    const possibleNames = [
      user.display_name,
      user.name,
      user.username,
      user.email?.split('@')[0],
      user.id?.substring(0, 8)
    ].filter(Boolean)

    for (const name of possibleNames) {
      if (name && typeof name === 'string' && name.length > 0) {
        // Clean up the name
        const cleaned = name.trim()
        if (cleaned !== 'undefined' && cleaned !== 'null' &&
            cleaned !== 'Anonymous User' && !cleaned.includes('{"')) {
          return cleaned
        }
      }
    }

    return user.id ? `User ${user.id.substring(0, 8)}` : 'Unknown User'
  }

  /**
   * Cache user lookup result
   */
  private cacheUser(userId: string, displayName: string): void {
    this.userCache.set(userId, displayName)
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_DURATION)
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.userCache.clear()
    this.cacheExpiry.clear()
    console.log('🧹 Audit user lookup cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number, expired: number } {
    const now = Date.now()
    let expired = 0

    for (const [, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        expired++
      }
    }

    return {
      size: this.userCache.size,
      expired
    }
  }

  /**
   * Preload users from localStorage for better performance
   */
  preloadUsersFromLocalStorage(): void {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.id) {
          const displayName = this.extractBestDisplayName(user)
          this.cacheUser(user.id, displayName)
          console.log(`✅ Preloaded current user: ${displayName}`)
        }
      }

      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        if (Array.isArray(users)) {
          users.forEach(user => {
            if (user.id) {
              const displayName = this.extractBestDisplayName(user)
              this.cacheUser(user.id, displayName)
            }
          })
          console.log(`✅ Preloaded ${users.length} system users`)
        }
      }
    } catch (error) {
      console.warn('Error preloading users:', error)
    }
  }
}

// Export singleton instance
export const auditUserLookupService = new AuditUserLookupService()

// Auto-preload users on service initialization
auditUserLookupService.preloadUsersFromLocalStorage()