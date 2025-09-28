/**
 * User Display Filter Utility
 *
 * Prevents unwanted "User User" patterns from appearing in the UI
 * Safe alternative to fixing avatar upload issues
 */

import React from 'react'

/**
 * Filters and cleans user display names to prevent confusing patterns
 * Enhanced to better handle encrypted data while preserving valid names
 */
export const cleanUserDisplayName = (displayName: string | null | undefined, userId?: string): string => {
  if (!displayName) {
    return userId ? `User ${userId.substring(0, 8)}` : 'System'
  }

  // Handle case where displayName might be an object (encrypted data)
  let name: string
  if (typeof displayName === 'object' && displayName !== null) {
    // Check if it's an encrypted object first
    if ('data' in displayName && 'iv' in displayName && 'tag' in displayName) {
      console.log('🔐 Detected encrypted object, audit system should decrypt this')
      return userId ? `User ${userId.substring(0, 8)}` : 'Encrypted User'
    }
    // If it's another type of object, convert to JSON string for processing
    name = JSON.stringify(displayName)
    console.log('📄 Converting object to string for processing')
  } else {
    name = displayName.toString().trim()
  }

  // Early return for valid, clean names
  if (name && name.length > 0 && name.length < 100 &&
      !name.includes('{') && !name.includes('"') &&
      !name.includes('data') && !name.includes('iv') &&
      name !== 'undefined' && name !== 'null' &&
      name !== 'Anonymous User' && name !== '[ENCRYPTED_DATA]') {
    // This looks like a valid user name, just clean it up
    const cleanName = name.replace(/^user\s+user$/i, 'Admin User')
    if (cleanName.toLowerCase() !== 'user user' && cleanName.toLowerCase() !== 'user') {
      return cleanName
    }
  }

  // Check for encrypted data patterns
  const encryptionPatterns = [
    () => name.includes('"data":"') && name.includes('"iv":"') && name.includes('"tag":"'),
    () => name.includes('==","iv":"') || name.includes('==","tag":"'),
    () => name.startsWith('{"') && name.includes('"data":"') && name.includes('"timestamp":'),
    () => name.includes('{"data":"') && name.length > 50,
    () => name.includes('"timestamp":') && (name.includes('"data":"') || name.includes('"iv":"')),
    () => name === '[ENCRYPTED_DATA]' || name === '[Encrypted]'
  ]

  for (const pattern of encryptionPatterns) {
    if (pattern()) {
      console.log('🔐 Detected encrypted data pattern, should be handled by audit decryption')
      return userId ? `User ${userId.substring(0, 8)}` : 'Encrypted User'
    }
  }

  // Check if it's a JSON object with encrypted structure
  try {
    const parsed = JSON.parse(name)
    if (parsed && typeof parsed === 'object') {
      if (parsed.data && parsed.iv && parsed.tag) {
        console.log('🔐 Detected encrypted JSON object, should be decrypted by audit system')
        return userId ? `User ${userId.substring(0, 8)}` : 'Encrypted User'
      }
    }
  } catch (e) {
    // Not JSON, continue with other checks
  }

  // Filter out "User User" patterns
  if (name.toLowerCase() === 'user user' ||
      name.toLowerCase() === 'user' ||
      name.match(/^user\s+user$/i)) {
    return 'Admin User'
  }

  // Filter out other unwanted patterns
  if (name.toLowerCase() === 'undefined' ||
      name.toLowerCase() === 'null' ||
      name === '' ||
      name === 'Anonymous User') {
    return userId ? `User ${userId.substring(0, 8)}` : 'System'
  }

  // If it starts with "User " and the rest is just "User", change it
  if (name.match(/^user\s+user/i)) {
    return 'Admin User'
  }

  // If we get here, return the name as-is
  return name
}

/**
 * Get a clean display name for any user object
 */
export const getCleanUserDisplay = (user: any): string => {
  if (!user) return 'System'

  // Try various name fields
  const possibleNames = [
    user.displayName,
    user.name,
    user.username,
    user.email,
    user.user_name,
    user.display_name
  ]

  for (const name of possibleNames) {
    if (name && typeof name === 'string') {
      const cleaned = cleanUserDisplayName(name, user.id || user.user_id)
      if (cleaned && cleaned !== 'System') {
        return cleaned
      }
    }
  }

  // Fallback with user ID
  const userId = user.id || user.user_id
  return userId ? `User ${userId.substring(0, 8)}` : 'System'
}

/**
 * React component helper to safely display user names
 */
export const SafeUserDisplay: React.FC<{
  user?: any,
  displayName?: string,
  fallback?: string
}> = ({ user, displayName, fallback = 'System' }) => {
  const cleanName = displayName
    ? cleanUserDisplayName(displayName, user?.id || user?.user_id)
    : getCleanUserDisplay(user) || fallback

  return <span>{cleanName}</span>
}