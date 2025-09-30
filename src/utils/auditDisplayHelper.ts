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
    // Parse user_name if it's a stringified JSON object from Supabase
    let parsedUserName = encryptedEntry.user_name
    if (typeof encryptedEntry.user_name === 'string' &&
        encryptedEntry.user_name.startsWith('{') &&
        encryptedEntry.user_name.includes('"data"')) {
      try {
        parsedUserName = JSON.parse(encryptedEntry.user_name)
        console.log('🔄 Parsed stringified user_name JSON from Supabase')
      } catch (e) {
        console.warn('⚠️ Failed to parse user_name JSON string:', e)
      }
    }

    // Create a copy without the encrypted user_name field
    const enhanced: DecryptedAuditEntry = {
      ...encryptedEntry,
      user_name: '', // Clear encrypted user_name to prevent it from being displayed
      displayName: 'Loading...' // Set initial placeholder
    }

    console.log('🔍 Processing audit entry:', {
      id: enhanced.id,
      user_id: enhanced.user_id,
      user_name_type: typeof parsedUserName,
      user_name_encrypted: parsedUserName && typeof parsedUserName === 'object' && parsedUserName.data ? 'YES' : 'NO',
      user_role: enhanced.user_role,
      action: enhanced.action,
      has_user_agent: !!enhanced.user_agent
    })

    // Update encryptedEntry with parsed user_name for decryption attempts
    const workingEntry = { ...encryptedEntry, user_name: parsedUserName }

    // Strategy 1: Check user_agent field first (contains plain text user info)
    if (enhanced.user_agent && typeof enhanced.user_agent === 'string') {
      // User agent often contains email or username
      // Example: "Mozilla/5.0... Email: pierre@phaetonai.com"
      const emailMatch = enhanced.user_agent.match(/Email:\s*([^\s,]+@[^\s,]+)/i)
      const userMatch = enhanced.user_agent.match(/User:\s*([^\s,]+)/i)

      if (emailMatch && emailMatch[1]) {
        const email = emailMatch[1]
        const displayName = email.includes('@') ? email.split('@')[0] : email
        enhanced.displayName = displayName
        enhanced.user_name = displayName
        console.log('✅ Extracted user from user_agent email:', displayName)
        userCache.set(enhanced.user_id, displayName)
        return enhanced
      } else if (userMatch && userMatch[1]) {
        enhanced.displayName = userMatch[1]
        enhanced.user_name = userMatch[1]
        console.log('✅ Extracted user from user_agent:', userMatch[1])
        userCache.set(enhanced.user_id, userMatch[1])
        return enhanced
      }
    }

    // Strategy 2: Look up user name from user_id
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

        // Strategy 3: Try to decrypt original stored name for verification/fallback
        if (workingEntry.user_name && typeof workingEntry.user_name === 'object' &&
            (workingEntry.user_name as any).data) {
          try {
            const decryptedName = await encryptionService.decrypt(workingEntry.user_name as any)
            console.log('🔓 Decrypted stored name:', decryptedName)

            // If decrypted name is more informative than lookup, use it
            if (decryptedName && decryptedName !== 'Anonymous User' &&
                !decryptedName.startsWith('User ') && !decryptedName.startsWith('Loading') &&
                decryptedName.length > (enhanced.displayName?.length || 0)) {
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

        // Clear user_name field to prevent encrypted data display
        enhanced.user_name = enhanced.displayName

      } catch (lookupError) {
        console.warn('⚠️ User lookup failed, trying decryption fallback:', lookupError)

        // Strategy 4: Fallback - try to decrypt user_name from working entry
        if (workingEntry.user_name && typeof workingEntry.user_name === 'object' &&
            (workingEntry.user_name as any).data) {
          try {
            const decryptedName = await encryptionService.decrypt(workingEntry.user_name as any)
            enhanced.displayName = decryptedName
            enhanced.user_name = decryptedName
            console.log('✅ Fallback decryption successful:', decryptedName)
            userCache.set(enhanced.user_id, decryptedName)
          } catch (decryptError: any) {
            console.warn('❌ Both lookup and decryption failed:', decryptError?.message || 'Unknown error')
            enhanced.displayName = createFallbackDisplayName(enhanced.user_id, enhanced.user_role)
            enhanced.user_name = enhanced.displayName
          }
        } else if (workingEntry.user_name && typeof workingEntry.user_name === 'string') {
          // If user_name is already a string (not encrypted), use it
          enhanced.displayName = workingEntry.user_name
          enhanced.user_name = workingEntry.user_name
          console.log('✅ Using plain text user name:', workingEntry.user_name)
        } else {
          enhanced.displayName = createFallbackDisplayName(enhanced.user_id, enhanced.user_role)
          enhanced.user_name = enhanced.displayName
        }
      }
    } else {
      // Strategy 5: No user_id available, try other methods
      if (workingEntry.user_name && typeof workingEntry.user_name === 'string') {
        enhanced.displayName = workingEntry.user_name
        enhanced.user_name = workingEntry.user_name
        console.log('✅ Using string user name:', workingEntry.user_name)
      } else if (workingEntry.user_name && typeof workingEntry.user_name === 'object' &&
                 (workingEntry.user_name as any).data) {
        try {
          const decryptedName = await encryptionService.decrypt(workingEntry.user_name as any)
          enhanced.displayName = decryptedName
          enhanced.user_name = decryptedName
          console.log('✅ Decrypted user name without user_id:', decryptedName)
        } catch (decryptError: any) {
          enhanced.displayName = createFallbackDisplayName(undefined, enhanced.user_role)
          enhanced.user_name = enhanced.displayName
          console.warn('⚠️ Could not decrypt user name, using role-based fallback')
        }
      } else {
        enhanced.displayName = createFallbackDisplayName(undefined, enhanced.user_role)
        enhanced.user_name = enhanced.displayName
      }
    }

    // Safely decrypt failure_reason if encrypted
    // Check if it's a string that looks like JSON first (Supabase sometimes returns stringified JSON)
    let parsedFailureReason = enhanced.failure_reason
    if (typeof enhanced.failure_reason === 'string' &&
        enhanced.failure_reason.startsWith('{') &&
        enhanced.failure_reason.includes('"data"')) {
      try {
        parsedFailureReason = JSON.parse(enhanced.failure_reason)
        console.log('🔄 Parsed stringified failure_reason JSON from Supabase')
      } catch (e) {
        console.warn('⚠️ Failed to parse failure_reason JSON string:', e)
      }
    }

    if (parsedFailureReason && typeof parsedFailureReason === 'object' &&
        (parsedFailureReason as any).data) {
      try {
        enhanced.failure_reason = await encryptionService.decrypt(parsedFailureReason as any)
        console.log('✅ Decrypted failure reason:', enhanced.failure_reason)
      } catch (decryptError: any) {
        console.warn('⚠️ Could not decrypt failure reason (legacy entry):', decryptError?.message || 'Unknown error')
        // For old entries that can't be decrypted, show a user-friendly message
        // These are legacy entries from before failure_reason was stored in plain text
        enhanced.failure_reason = '[Legacy audit entry - reason not available]'
      }
    } else if (typeof enhanced.failure_reason === 'string' &&
               enhanced.failure_reason.includes('"data"') &&
               enhanced.failure_reason.includes('"iv"')) {
      // If it looks like an encrypted object but parsing failed, show legacy message
      console.warn('⚠️ Failed to parse legacy encrypted failure_reason')
      enhanced.failure_reason = '[Legacy audit entry - reason not available]'
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