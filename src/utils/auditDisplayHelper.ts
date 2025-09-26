/**
 * Audit Display Helper
 *
 * SAFE IMPLEMENTATION: Enhances audit display without modifying core audit logging
 * - Maintains HIPAA compliance by keeping storage encrypted
 * - Only decrypts data for display purposes
 * - Does not modify the protected audit logging system
 */

import { encryptionService } from '@/services/encryption'

// Cache for user lookups to avoid repeated database calls
const userCache = new Map<string, string>()

/**
 * Get readable user name from user ID
 * This is a safe alternative to decrypting audit data
 */
const getUserNameFromId = async (userId: string): Promise<string> => {
  if (!userId) return 'Unknown User'

  // Check cache first
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }

  try {
    // Try to get current user data from localStorage
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const user = JSON.parse(currentUser)
      if (user.id === userId || user.user_id === userId) {
        const displayName = user.name || user.email || user.username || `User ${userId.substring(0, 8)}`
        userCache.set(userId, displayName)
        return displayName
      }
    }

    // Try to get from recent users or settings
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (key.startsWith('settings_') || key.startsWith('user_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          if (data.user_id === userId || data.id === userId) {
            const displayName = data.name || data.email || data.username || `User ${userId.substring(0, 8)}`
            userCache.set(userId, displayName)
            return displayName
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Fallback: create a readable ID-based name (avoid "User User" pattern)
    const shortId = userId.substring(0, 8)
    const fallbackName = shortId.toLowerCase() === 'user' || userId.toLowerCase().includes('user')
      ? 'Admin User'
      : `User ${shortId}`
    userCache.set(userId, fallbackName)
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
 */
export const enhanceAuditEntryForDisplay = async (
  encryptedEntry: any
): Promise<DecryptedAuditEntry> => {
  try {
    const enhanced: DecryptedAuditEntry = { ...encryptedEntry }

    // Debug logging
    console.log('Processing audit entry:', {
      id: enhanced.id,
      user_id: enhanced.user_id,
      user_name_type: typeof enhanced.user_name,
      user_name_sample: enhanced.user_name ? JSON.stringify(enhanced.user_name).substring(0, 100) : 'null'
    })

    // Primary strategy: Look up user name from user_id
    if (enhanced.user_id) {
      try {
        console.log('Looking up user name for ID:', enhanced.user_id)
        const lookupName = await getUserNameFromId(enhanced.user_id)
        enhanced.displayName = lookupName
        console.log('Found user name:', lookupName)

        // Try to decrypt stored name as backup verification
        if (enhanced.user_name && typeof enhanced.user_name === 'object' && enhanced.user_name.data) {
          try {
            const decryptedName = await encryptionService.decrypt(enhanced.user_name)
            console.log('Decrypted name matches lookup:', decryptedName === lookupName ? 'YES' : 'NO')
            // Use lookup name as it's more reliable
          } catch (decryptError) {
            console.warn('Stored name decryption failed (using lookup instead):', decryptError)
          }
        }
      } catch (lookupError) {
        console.warn('User lookup failed, trying decryption:', lookupError)

        // Fallback: try to decrypt user_name
        if (enhanced.user_name && typeof enhanced.user_name === 'object' && enhanced.user_name.data) {
          try {
            const decryptedName = await encryptionService.decrypt(enhanced.user_name)
            enhanced.displayName = decryptedName
            console.log('Fallback decryption successful:', decryptedName)
          } catch (decryptError) {
            console.warn('Both lookup and decryption failed:', decryptError)
            const shortId = enhanced.user_id?.substring(0, 8) || 'Unknown'
            enhanced.displayName = (shortId.toLowerCase() === 'user' || enhanced.user_id?.toLowerCase().includes('user'))
              ? 'Admin User'
              : `User ${shortId}`
          }
        } else {
          const shortId = enhanced.user_id?.substring(0, 8) || 'Unknown'
          enhanced.displayName = (shortId.toLowerCase() === 'user' || enhanced.user_id?.toLowerCase().includes('user'))
            ? 'Admin User'
            : `User ${shortId}`
        }
      }
    } else {
      // No user_id available, try other methods
      if (enhanced.user_name && typeof enhanced.user_name === 'string') {
        enhanced.displayName = enhanced.user_name
      } else {
        enhanced.displayName = 'Unknown User'
      }
    }

    // Safely decrypt failure_reason if encrypted
    if (enhanced.failure_reason && typeof enhanced.failure_reason === 'object' && enhanced.failure_reason.data) {
      try {
        enhanced.failure_reason = await encryptionService.decrypt(enhanced.failure_reason)
      } catch (decryptError) {
        enhanced.failure_reason = '[Encrypted - Unable to decrypt]'
      }
    }

    // Safely decrypt additional_info if encrypted
    if (enhanced.additional_info && typeof enhanced.additional_info === 'object' && enhanced.additional_info.data) {
      try {
        const decryptedInfo = await encryptionService.decrypt(enhanced.additional_info)
        enhanced.additional_info = JSON.parse(decryptedInfo)
      } catch (decryptError) {
        enhanced.additional_info = { encrypted: true, message: 'Unable to decrypt additional info' }
      }
    }

    return enhanced
  } catch (error) {
    console.error('Error enhancing audit entry for display:', error)

    // Fallback: Return with safe display values
    return {
      ...encryptedEntry,
      displayName: `User ${encryptedEntry.user_id?.substring(0, 8) || 'Unknown'}`,
      user_name: `User ${encryptedEntry.user_id?.substring(0, 8) || 'Unknown'}`,
      failure_reason: encryptedEntry.failure_reason || '[Encrypted]',
      additional_info: encryptedEntry.additional_info || { encrypted: true }
    }
  }
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