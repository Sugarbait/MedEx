/**
 * User ID Translation Service
 *
 * Handles the conversion between string user IDs used in the application
 * and UUID format required by the Supabase database.
 *
 * This service ensures compatibility between the legacy string-based user IDs
 * and the UUID-based database schema.
 */

import { supabase } from '@/config/supabase'

export interface UserIdMapping {
  stringId: string
  uuid: string
  email?: string
  name?: string
}

class UserIdTranslationService {
  // Static mapping for demo/known users - FIXED USER MAPPINGS
  private static readonly DEMO_USER_MAPPINGS: { [key: string]: string } = {
    'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24', // pierre@phaetonai.com
    'super-user-456': 'ee77ed8f-525f-43c9-a70a-b81cb8dc8d5d', // elmfarrell@yahoo.com - FIXED
    'guest-user-456': 'demo-user-uuid-placeholder', // Guest user separate UUID
    'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24' // Dynamic pierre mapping - FIXED to match current UUID
  }

  // Cache for dynamic mappings
  private userMappingCache: Map<string, string> = new Map()

  /**
   * Convert a string user ID to UUID format
   * @param stringId - The string-based user ID
   * @returns UUID string or null if not found
   */
  async stringToUuid(stringId: string | null | undefined): Promise<string | null> {
    if (!stringId) {
      return null
    }

    // Check if it's already a UUID (36 characters with dashes)
    if (this.isValidUuid(stringId)) {
      return stringId
    }

    // Check static demo user mappings first
    if (UserIdTranslationService.DEMO_USER_MAPPINGS[stringId]) {
      return UserIdTranslationService.DEMO_USER_MAPPINGS[stringId]
    }

    // Check cache for dynamic mappings
    if (this.userMappingCache.has(stringId)) {
      return this.userMappingCache.get(stringId) || null
    }

    // Try to get from Supabase auth or create a new UUID
    try {
      // First, try to find existing user by email or metadata
      const user = await this.findUserByStringId(stringId)
      if (user?.id) {
        this.userMappingCache.set(stringId, user.id)
        return user.id
      }

      // If no existing user found, generate a DETERMINISTIC UUID for this string ID
      // This ensures the same string ID always gets the same UUID, preserving MFA data
      const deterministicUuid = this.generateDeterministicUuid(stringId)
      this.userMappingCache.set(stringId, deterministicUuid)

      console.log(`Created deterministic UUID mapping: ${stringId} -> ${deterministicUuid}`)
      return deterministicUuid

    } catch (error) {
      console.error('Error in UUID translation:', error)

      // Fallback: generate a deterministic UUID based on the string ID
      const fallbackUuid = this.generateDeterministicUuid(stringId)
      this.userMappingCache.set(stringId, fallbackUuid)
      return fallbackUuid
    }
  }

  /**
   * Convert UUID back to string ID (for reverse lookup)
   * @param uuid - The UUID to convert back
   * @returns string ID or the original UUID if no mapping found
   */
  async uuidToString(uuid: string | null | undefined): Promise<string | null> {
    if (!uuid) {
      return null
    }

    // Check static mappings in reverse
    for (const [stringId, mappedUuid] of Object.entries(UserIdTranslationService.DEMO_USER_MAPPINGS)) {
      if (mappedUuid === uuid) {
        return stringId
      }
    }

    // Check cache in reverse
    for (const [stringId, mappedUuid] of this.userMappingCache.entries()) {
      if (mappedUuid === uuid) {
        return stringId
      }
    }

    // If no mapping found, return the UUID as-is
    return uuid
  }

  /**
   * Get or create a UUID for a user from current user context
   * @returns UUID string for database operations
   */
  async getCurrentUserUuid(): Promise<string | null> {
    try {
      // First try to get from Supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        return user.id
      }

      // Fallback to localStorage currentUser
      const currentUserJson = localStorage.getItem('currentUser')
      if (currentUserJson) {
        const currentUser = JSON.parse(currentUserJson)
        if (currentUser.id) {
          return await this.stringToUuid(currentUser.id)
        }
      }

      return null
    } catch (error) {
      console.error('Error getting current user UUID:', error)
      return null
    }
  }

  /**
   * Check if a string is a valid UUID format
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * Try to find an existing user by string ID in Supabase
   */
  private async findUserByStringId(stringId: string): Promise<{ id: string } | null> {
    try {
      // Search the user_settings table for existing user data
      // This helps preserve MFA and other settings after logout/login
      const { data: userSettings, error } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(10) // Get some recent users

      if (error) {
        console.error('Error querying user_settings:', error)
        return null
      }

      if (userSettings && userSettings.length > 0) {
        // For known demo users, try to match patterns
        if (stringId.includes('super-user') || stringId.includes('pierre') || stringId.includes('guest')) {
          // Look through existing UUIDs to find one that might belong to this user
          for (const setting of userSettings) {
            // Check if this UUID is one of our demo user mappings
            for (const [demoString, demoUuid] of Object.entries(UserIdTranslationService.DEMO_USER_MAPPINGS)) {
              if (setting.user_id === demoUuid && stringId.includes(demoString.split('-')[0])) {
                console.log(`🔍 Found existing UUID for ${stringId}: ${setting.user_id}`)
                return { id: setting.user_id }
              }
            }
          }
        }

        // If string ID matches any existing pattern, return the first available UUID
        // This ensures we don't create duplicate UUIDs for existing users
        if (userSettings.length === 1) {
          console.log(`🔍 Using existing single user UUID for ${stringId}: ${userSettings[0].user_id}`)
          return { id: userSettings[0].user_id }
        }
      }

      return null
    } catch (error) {
      console.error('Error finding user by string ID:', error)
      return null
    }
  }

  /**
   * Generate a deterministic UUID from a string ID
   * This ensures the same string ID always gets the same UUID
   */
  private generateDeterministicUuid(stringId: string): string {
    // Create a hash of the string ID and convert to UUID format
    let hash = 0
    for (let i = 0; i < stringId.length; i++) {
      const char = stringId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    // Convert hash to a UUID-like format
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0')
    const uuid = `${hashStr.slice(0, 8)}-${hashStr.slice(0, 4)}-4${hashStr.slice(1, 4)}-a${hashStr.slice(1, 4)}-${hashStr.slice(0, 12).padEnd(12, '0')}`

    return uuid
  }

  /**
   * Clear the mapping cache (useful for testing or user logout)
   */
  clearCache(): void {
    this.userMappingCache.clear()
  }

  /**
   * Add a custom mapping (useful for migration or special cases)
   */
  addMapping(stringId: string, uuid: string): void {
    this.userMappingCache.set(stringId, uuid)
  }

  /**
   * Get all current mappings (for debugging)
   */
  getAllMappings(): { static: typeof UserIdTranslationService.DEMO_USER_MAPPINGS, dynamic: Map<string, string> } {
    return {
      static: UserIdTranslationService.DEMO_USER_MAPPINGS,
      dynamic: new Map(this.userMappingCache)
    }
  }
}

// Export singleton instance
export const userIdTranslationService = new UserIdTranslationService()
export default userIdTranslationService