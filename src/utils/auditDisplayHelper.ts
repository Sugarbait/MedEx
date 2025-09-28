/**
 * Audit Display Helper
 *
 * SAFE IMPLEMENTATION: Enhances audit display without modifying core audit logging
 * - Maintains HIPAA compliance by keeping storage encrypted
 * - Only decrypts data for display purposes
 * - Does not modify the protected audit logging system
 */

import { encryptionService } from '@/services/encryption'
import { auditUserLookupService } from '@/services/auditUserLookupService'

// Cache for user lookups to avoid repeated database calls
const userCache = new Map<string, string>()

/**
 * Get readable user name from user ID
 * Enhanced to handle multiple lookup strategies for audit logs
 */
const getUserNameFromId = async (userId: string): Promise<string> => {
  if (!userId) return 'Unknown User'

  // Check cache first
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }

  try {
    // Strategy 1: Try to get current user data from localStorage
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const user = JSON.parse(currentUser)
      if (user.id === userId || user.user_id === userId) {
        const displayName = user.name || user.display_name || user.email || user.username || `User ${userId.substring(0, 8)}`
        userCache.set(userId, displayName)
        console.log(`✅ Found user from currentUser: ${displayName}`)
        return displayName
      }
    }

    // Strategy 2: Try to get from recent users or settings
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (key.startsWith('settings_') || key.startsWith('user_') || key.startsWith('profile_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          if (data.user_id === userId || data.id === userId) {
            const displayName = data.name || data.display_name || data.email || data.username || `User ${userId.substring(0, 8)}`
            userCache.set(userId, displayName)
            console.log(`✅ Found user from ${key}: ${displayName}`)
            return displayName
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Strategy 3: Check systemUsers for admin accounts
    const systemUsers = localStorage.getItem('systemUsers')
    if (systemUsers) {
      try {
        const users = JSON.parse(systemUsers)
        const foundUser = users.find((u: any) => u.id === userId || u.user_id === userId)
        if (foundUser) {
          const displayName = foundUser.name || foundUser.display_name || foundUser.email || foundUser.username || `User ${userId.substring(0, 8)}`
          userCache.set(userId, displayName)
          console.log(`✅ Found user from systemUsers: ${displayName}`)
          return displayName
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    // Strategy 4: Check if userId looks like an email or username
    if (userId.includes('@') || userId.includes('.')) {
      // If userId is actually an email or username, use it as display name
      const displayName = userId.split('@')[0] || userId
      userCache.set(userId, displayName)
      console.log(`✅ Using userId as display name: ${displayName}`)
      return displayName
    }

    // Fallback: create a readable ID-based name (avoid "User User" pattern)
    const shortId = userId.substring(0, 8)
    const fallbackName = shortId.toLowerCase() === 'user' || userId.toLowerCase().includes('user')
      ? 'Admin User'
      : `User ${shortId}`
    userCache.set(userId, fallbackName)
    console.log(`⚠️ Using fallback name: ${fallbackName}`)
    return fallbackName

  } catch (error) {
    console.warn('Error looking up user name:', error)
    const shortId = userId.substring(0, 8)
    const fallbackName = shortId.toLowerCase() === 'user' || userId.toLowerCase().includes('user')
      ? 'Admin User'
      : `User ${shortId}`
    userCache.set(userId, fallbackName)
    return fallbackName
  }
}

export interface DecryptedAuditEntry {
  id?: string
  timestamp: string
  user_id: string
  user_name: string
  user_role: string
  action: string
  resource_type: string
  resource_id: string
  phi_accessed: boolean
  source_ip: string
  user_agent: string
  session_id: string
  outcome: string
  failure_reason?: string
  additional_info?: any
  created_at?: string
  displayName?: string // Enhanced readable name
}

/**
 * Safely decrypt and enhance audit entry for display
 * Does not modify the original audit storage - display only
 * Enhanced with better decryption handling and user resolution
 */
export const enhanceAuditEntryForDisplay = async (
  encryptedEntry: any
): Promise<DecryptedAuditEntry> => {
  try {
    const enhanced: DecryptedAuditEntry = { ...encryptedEntry }

    console.log('🔍 Processing audit entry:', {
      id: enhanced.id,
      user_id: enhanced.user_id,
      user_name_type: typeof enhanced.user_name,
      user_name_encrypted: enhanced.user_name && typeof enhanced.user_name === 'object' && enhanced.user_name.data ? 'YES' : 'NO',
      user_role: enhanced.user_role,
      action: enhanced.action
    })

    // Strategy 1: Primary - Look up user name from user_id (most reliable)
    if (enhanced.user_id) {
      try {
        console.log('🔍 Looking up user name for ID:', enhanced.user_id)
        const lookupResult = await auditUserLookupService.lookupUser(enhanced.user_id, enhanced.user_role)
        if (lookupResult.success && lookupResult.displayName) {
          enhanced.displayName = lookupResult.displayName
          console.log(`✅ Found user name via ${lookupResult.source}:`, lookupResult.displayName)
        } else {
          // Fallback to legacy lookup
          const legacyLookup = await getUserNameFromId(enhanced.user_id)
          enhanced.displayName = legacyLookup
          console.log('🔄 Using legacy lookup:', legacyLookup)
        }

        // Strategy 2: Try to decrypt stored name for verification/fallback
        if (enhanced.user_name && typeof enhanced.user_name === 'object' &&
            (enhanced.user_name as any).data) {
          try {
            const decryptedName = await encryptionService.decrypt(enhanced.user_name as any)
            console.log('🔓 Decrypted stored name:', decryptedName)

            // If decrypted name is more informative than lookup, use it
            if (decryptedName && decryptedName !== 'Anonymous User' &&
                !decryptedName.startsWith('User ') &&
                decryptedName.length > enhanced.displayName.length) {
              enhanced.displayName = decryptedName
              console.log('✅ Using decrypted name as it\'s more informative:', decryptedName)
            }

            // Store in cache for future use
            userCache.set(enhanced.user_id, enhanced.displayName)
          } catch (decryptError: any) {
            console.warn('⚠️ Stored name decryption failed (using lookup instead):', decryptError?.message || 'Unknown error')
            // Keep the lookup name
          }
        }

      } catch (lookupError) {
        console.warn('⚠️ User lookup failed, trying decryption fallback:', lookupError)

        // Strategy 3: Fallback - try to decrypt user_name directly
        if (enhanced.user_name && typeof enhanced.user_name === 'object' &&
            (enhanced.user_name as any).data) {
          try {
            const decryptedName = await encryptionService.decrypt(enhanced.user_name as any)
            enhanced.displayName = decryptedName
            console.log('✅ Fallback decryption successful:', decryptedName)
            userCache.set(enhanced.user_id, decryptedName)
          } catch (decryptError: any) {
            console.warn('❌ Both lookup and decryption failed:', decryptError?.message || 'Unknown error')
            enhanced.displayName = createFallbackDisplayName(enhanced.user_id, enhanced.user_role)
          }
        } else if (enhanced.user_name && typeof enhanced.user_name === 'string') {
          // If user_name is already a string (not encrypted), use it
          enhanced.displayName = enhanced.user_name
          console.log('✅ Using plain text user name:', enhanced.user_name)
        } else {
          enhanced.displayName = createFallbackDisplayName(enhanced.user_id, enhanced.user_role)
        }
      }
    } else {
      // Strategy 4: No user_id available, try other methods
      if (enhanced.user_name && typeof enhanced.user_name === 'string') {
        enhanced.displayName = enhanced.user_name
        console.log('✅ Using string user name:', enhanced.user_name)
      } else if (enhanced.user_name && typeof enhanced.user_name === 'object' &&
                 (enhanced.user_name as any).data) {
        try {
          const decryptedName = await encryptionService.decrypt(enhanced.user_name as any)
          enhanced.displayName = decryptedName
          console.log('✅ Decrypted user name without user_id:', decryptedName)
        } catch (decryptError: any) {
          enhanced.displayName = createFallbackDisplayName(undefined, enhanced.user_role)
          console.warn('⚠️ Could not decrypt user name, using role-based fallback')
        }
      } else {
        enhanced.displayName = createFallbackDisplayName(undefined, enhanced.user_role)
      }
    }

    // Safely decrypt failure_reason if encrypted
    if (enhanced.failure_reason && typeof enhanced.failure_reason === 'object' &&
        (enhanced.failure_reason as any).data) {
      try {
        enhanced.failure_reason = await encryptionService.decrypt(enhanced.failure_reason as any)
        console.log('✅ Decrypted failure reason')
      } catch (decryptError: any) {
        enhanced.failure_reason = '[Encrypted - Unable to decrypt]'
        console.warn('⚠️ Could not decrypt failure reason')
      }
    }

    // Safely decrypt additional_info if encrypted
    if (enhanced.additional_info && typeof enhanced.additional_info === 'object' &&
        (enhanced.additional_info as any).data) {
      try {
        const decryptedInfo = await encryptionService.decrypt(enhanced.additional_info as any)
        enhanced.additional_info = JSON.parse(decryptedInfo)
        console.log('✅ Decrypted additional info')
      } catch (decryptError: any) {
        enhanced.additional_info = { encrypted: true, message: 'Unable to decrypt additional info' }
        console.warn('⚠️ Could not decrypt additional info')
      }
    }

    console.log('✅ Enhanced audit entry completed:', {
      id: enhanced.id,
      displayName: enhanced.displayName,
      user_role: enhanced.user_role,
      action: enhanced.action
    })

    return enhanced
  } catch (error) {
    console.error('❌ Error enhancing audit entry for display:', error)

    // Fallback: Return with safe display values
    const fallbackDisplayName = createFallbackDisplayName(encryptedEntry.user_id, encryptedEntry.user_role)

    return {
      ...encryptedEntry,
      displayName: fallbackDisplayName,
      user_name: fallbackDisplayName,
      failure_reason: encryptedEntry.failure_reason || '[Encrypted]',
      additional_info: encryptedEntry.additional_info || { encrypted: true }
    }
  }
}

/**
 * Create a fallback display name based on user ID and role
 */
function createFallbackDisplayName(userId?: string, userRole?: string): string {
  if (userRole === 'super_user' || userRole === 'admin') {
    return 'Admin User'
  }

  if (userId) {
    const shortId = userId.substring(0, 8)
    return shortId.toLowerCase() === 'user' || userId.toLowerCase().includes('user')
      ? 'Admin User'
      : `User ${shortId}`
  }

  return 'Unknown User'
}

/**
 * Enhance multiple audit entries for display
 */
export const enhanceAuditEntriesForDisplay = async (
  encryptedEntries: any[]
): Promise<DecryptedAuditEntry[]> => {
  const enhanced: DecryptedAuditEntry[] = []

  for (const entry of encryptedEntries) {
    try {
      const enhancedEntry = await enhanceAuditEntryForDisplay(entry)
      enhanced.push(enhancedEntry)
    } catch (error) {
      console.error('Failed to enhance audit entry:', error)
      // Include entry with fallback display values
      enhanced.push({
        ...entry,
        displayName: `User ${entry.user_id?.substring(0, 8) || 'Unknown'}`,
        user_name: `User ${entry.user_id?.substring(0, 8) || 'Unknown'}`,
        failure_reason: '[Encrypted]',
        additional_info: { encrypted: true }
      })
    }
  }

  return enhanced
}

/**
 * Get user display name from user ID (fallback method)
 * Filters out unwanted "User User" patterns
 */
export const getUserDisplayName = (userId: string): string => {
  if (!userId) return 'System'

  // Create a readable display name from user ID
  const shortId = userId.substring(0, 8)

  // Avoid "User User" pattern - use different format
  if (shortId.toLowerCase() === 'user' || userId.toLowerCase().includes('user')) {
    return 'Admin User'
  }

  return `User ${shortId}`
}

/**
 * Format audit action for display
 */
export const formatAuditAction = (action: string): string => {
  if (!action) return 'UNKNOWN'

  return action.replace(/_/g, ' ').toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format audit outcome for display
 */
export const formatAuditOutcome = (outcome: string): { text: string, color: string } => {
  switch (outcome?.toLowerCase()) {
    case 'success':
      return { text: 'Success', color: 'text-green-600' }
    case 'failure':
      return { text: 'Failed', color: 'text-red-600' }
    case 'warning':
      return { text: 'Warning', color: 'text-yellow-600' }
    default:
      return { text: outcome || 'Unknown', color: 'text-gray-600' }
  }
}