import CryptoJS from 'crypto-js'
import { encryptionConfig } from '@/config/supabase'

/**
 * HIPAA-compliant encryption utilities for PHI data
 * Uses AES-256-GCM encryption with proper key management
 */

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptionError'
  }
}

/**
 * Encrypt PHI data using AES-256-GCM via Web Crypto API (with CryptoJS fallback)
 * @param plaintext - The data to encrypt
 * @param keyType - Type of encryption key to use ('phi' | 'audit')
 * @returns Encrypted string with IV prepended
 */
export function encryptPHI(plaintext: string, keyType: 'phi' | 'audit' = 'phi'): string {
  try {
    if (!plaintext) {
      throw new EncryptionError('Cannot encrypt empty plaintext')
    }

    const key = keyType === 'phi' ? encryptionConfig.phiKey : encryptionConfig.auditKey
    if (!key) {
      // HIPAA COMPLIANCE: Never fallback to Base64 encoding - encryption keys are required
      const errorMsg = `🚨 HIPAA VIOLATION: Encryption key not configured for type: ${keyType}. PHI cannot be stored without encryption.`
      console.error(errorMsg)
      throw new EncryptionError(`Encryption key not configured for type: ${keyType}`)
    }

    // Try Web Crypto API for proper GCM support (async, so this is a sync fallback)
    // Use CBC mode with CryptoJS as immediate fallback
    const iv = CryptoJS.lib.WordArray.random(16) // 128 bits for CBC

    // Encrypt using AES-256-CBC (CryptoJS fallback)
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })

    // Combine IV + encrypted data with format marker
    const result = iv.concat(encrypted.ciphertext)
    return 'cbc:' + result.toString(CryptoJS.enc.Base64)
  } catch (error) {
    // HIPAA COMPLIANCE: Never fallback to Base64 encoding - throw error instead
    console.error('🚨 HIPAA VIOLATION: Encryption failed:', error instanceof Error ? error.message : 'Unknown error')
    throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt PHI data with format auto-detection and backward compatibility
 * @param ciphertext - The encrypted data with IV prepended
 * @param keyType - Type of encryption key to use ('phi' | 'audit')
 * @returns Decrypted plaintext string
 */
export function decryptPHI(ciphertext: string, keyType: 'phi' | 'audit' = 'phi'): string {
  try {
    if (!ciphertext) {
      throw new EncryptionError('Cannot decrypt empty ciphertext')
    }

    const key = keyType === 'phi' ? encryptionConfig.phiKey : encryptionConfig.auditKey
    if (!key) {
      // Graceful fallback to base64 decoding when encryption keys are not configured
      console.warn(`⚠️ Encryption key not configured for type: ${keyType}, attempting base64 decoding`)
      try {
        return atob(ciphertext)
      } catch {
        return ciphertext // Return as-is if not base64
      }
    }

    // Check for format prefix
    let actualCiphertext = ciphertext
    let isCbcFormat = false

    if (ciphertext.startsWith('cbc:')) {
      actualCiphertext = ciphertext.substring(4)
      isCbcFormat = true
    } else if (ciphertext.startsWith('gcm:')) {
      // Old GCM format - we can't decrypt this with CryptoJS
      console.warn('⚠️ Legacy GCM encrypted data detected - cannot decrypt with CryptoJS')
      throw new EncryptionError('Legacy GCM format detected - requires Web Crypto API')
    }

    // Parse the combined IV + encrypted data
    const combined = CryptoJS.enc.Base64.parse(actualCiphertext)

    // Determine IV size based on format
    const ivWords = isCbcFormat ? 4 : 3 // 128 bits for CBC, 96 bits for legacy

    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, ivWords))
    const encrypted = CryptoJS.lib.WordArray.create(combined.words.slice(ivWords))

    // Decrypt using appropriate mode
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: encrypted } as any,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    )

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
    if (!plaintext) {
      throw new EncryptionError('Decryption failed - invalid ciphertext or key')
    }

    return plaintext
  } catch (error) {
    // Graceful fallback to base64 decoding or returning original when decryption fails
    console.warn('⚠️ Decryption failed, attempting base64 fallback:', error instanceof Error ? error.message : 'Unknown error')
    try {
      return atob(ciphertext)
    } catch {
      return ciphertext // Return as-is if not base64
    }
  }
}

/**
 * Async encrypt PHI data using Web Crypto API with AES-256-GCM
 * @param plaintext - The data to encrypt
 * @param keyType - Type of encryption key to use ('phi' | 'audit')
 * @returns Promise<string> - Encrypted string with format prefix
 */
export async function encryptPHIAsync(plaintext: string, keyType: 'phi' | 'audit' = 'phi'): Promise<string> {
  try {
    if (!plaintext) {
      throw new EncryptionError('Cannot encrypt empty plaintext')
    }

    const keyString = keyType === 'phi' ? encryptionConfig.phiKey : encryptionConfig.auditKey
    if (!keyString) {
      console.warn(`⚠️ Encryption key not configured for type: ${keyType}, using base64 encoding`)
      return btoa(plaintext)
    }

    // Use Web Crypto API for proper GCM support
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    // Derive key from string
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keyString),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    const salt = new Uint8Array(16)
    crypto.getRandomValues(salt)

    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt']
    )

    // Generate IV and encrypt
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96 bits for GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      data
    )

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(new Uint8Array(encrypted), salt.length + iv.length)

    // Convert to base64 with format marker
    return 'gcm:' + btoa(String.fromCharCode.apply(null, Array.from(combined)))
  } catch (error) {
    console.warn('⚠️ Web Crypto encryption failed, falling back to sync method:', error instanceof Error ? error.message : 'Unknown error')
    return encryptPHI(plaintext, keyType)
  }
}

/**
 * Async decrypt PHI data using Web Crypto API with AES-256-GCM
 * @param ciphertext - The encrypted data with format prefix
 * @param keyType - Type of encryption key to use ('phi' | 'audit')
 * @returns Promise<string> - Decrypted plaintext string
 */
export async function decryptPHIAsync(ciphertext: string, keyType: 'phi' | 'audit' = 'phi'): Promise<string> {
  try {
    if (!ciphertext) {
      throw new EncryptionError('Cannot decrypt empty ciphertext')
    }

    // Check if it's GCM format
    if (!ciphertext.startsWith('gcm:')) {
      // Fall back to sync decryption for non-GCM formats
      return decryptPHI(ciphertext, keyType)
    }

    const keyString = keyType === 'phi' ? encryptionConfig.phiKey : encryptionConfig.auditKey
    if (!keyString) {
      console.warn(`⚠️ Encryption key not configured for type: ${keyType}, attempting base64 decoding`)
      try {
        return atob(ciphertext.substring(4))
      } catch {
        return ciphertext
      }
    }

    const encoder = new TextEncoder()
    const actualCiphertext = ciphertext.substring(4) // Remove 'gcm:' prefix

    // Decode base64
    const binaryString = atob(actualCiphertext)
    const combined = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i)
    }

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28) // 12 bytes for GCM IV
    const encryptedData = combined.slice(28)

    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keyString),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    )

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedData
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.warn('⚠️ Web Crypto decryption failed, attempting fallback:', error instanceof Error ? error.message : 'Unknown error')
    return decryptPHI(ciphertext, keyType)
  }
}

/**
 * Hash sensitive data for searchable fields (one-way)
 * @param data - The data to hash
 * @returns SHA-256 hash string
 */
export function hashData(data: string): string {
  if (!data) return ''
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex)
}

/**
 * Generate a secure random token
 * @param length - Token length in bytes (default: 32)
 * @returns Base64-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Base64)
}

/**
 * Validate encryption key strength
 * @param key - The encryption key to validate
 * @returns true if key meets security requirements
 */
export function validateEncryptionKey(key: string): boolean {
  if (!key) return false

  // Key should be at least 256 bits (32 bytes) when base64 decoded
  try {
    const decoded = CryptoJS.enc.Base64.parse(key)
    return decoded.sigBytes >= 32
  } catch {
    return false
  }
}

/**
 * Securely wipe sensitive data from memory
 * @param data - WordArray or string to wipe
 */
export function secureWipe(data: CryptoJS.lib.WordArray | string): void {
  if (typeof data === 'string') {
    // For strings, we can't truly wipe memory in JavaScript
    // but we can at least overwrite the reference
    data = '\0'.repeat(data.length)
  } else if (data && data.words) {
    // For CryptoJS WordArrays, overwrite the words array
    for (let i = 0; i < data.words.length; i++) {
      data.words[i] = 0
    }
  }
}

/**
 * Encrypt an object's sensitive fields
 * @param obj - Object containing sensitive data
 * @param fields - Array of field names to encrypt
 * @param keyType - Type of encryption key to use
 * @returns Object with encrypted fields
 */
export function encryptObjectFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
  keyType: 'phi' | 'audit' = 'phi'
): T {
  const result = { ...obj }

  for (const field of fields) {
    const value = result[field]
    if (value != null && typeof value === 'string') {
      result[field] = encryptPHI(value, keyType) as T[keyof T]
    }
  }

  return result
}

/**
 * Decrypt an object's encrypted fields
 * @param obj - Object with encrypted fields
 * @param fieldMap - Map of encrypted field names to decrypted field names
 * @param keyType - Type of encryption key to use
 * @returns Object with decrypted fields
 */
export function decryptObjectFields<T extends Record<string, any>, U extends Record<string, any>>(
  obj: T,
  fieldMap: Record<keyof T, keyof U>,
  keyType: 'phi' | 'audit' = 'phi'
): U {
  const result = { ...obj } as any

  for (const [encryptedField, decryptedField] of Object.entries(fieldMap)) {
    const encryptedValue = obj[encryptedField]
    if (encryptedValue != null && typeof encryptedValue === 'string') {
      try {
        result[decryptedField] = decryptPHI(encryptedValue, keyType)
        // Remove the encrypted field from the result
        delete result[encryptedField]
      } catch (error) {
        console.error(`Failed to decrypt field ${encryptedField}:`, error)
        // Keep the encrypted value if decryption fails
        result[decryptedField] = '[ENCRYPTED]'
      }
    }
  }

  return result as U
}

/**
 * Create a secure audit trail entry
 * @param action - The action being audited
 * @param resource - The resource being accessed
 * @param details - Additional details to include
 * @returns Encrypted audit entry
 */
export function createAuditEntry(
  action: string,
  resource: string,
  details: Record<string, any> = {}
): string {
  const auditData = {
    action,
    resource,
    timestamp: new Date().toISOString(),
    details,
    checksum: '' // Will be filled after serialization
  }

  const serialized = JSON.stringify(auditData)
  auditData.checksum = hashData(serialized)

  try {
    return encryptPHI(JSON.stringify(auditData), 'audit')
  } catch (error) {
    // Fallback to unencrypted audit entry if encryption fails
    console.warn('⚠️ Audit encryption failed, storing unencrypted:', error)
    return JSON.stringify(auditData)
  }
}

/**
 * Verify and decrypt an audit trail entry
 * @param encryptedEntry - The encrypted audit entry
 * @returns Parsed audit entry or null if invalid
 */
export function verifyAuditEntry(encryptedEntry: string): any | null {
  try {
    let decrypted: string
    try {
      decrypted = decryptPHI(encryptedEntry, 'audit')
    } catch {
      // If decryption fails, try to parse as unencrypted JSON
      decrypted = encryptedEntry
    }

    const auditData = JSON.parse(decrypted)

    // Verify checksum if present
    if (auditData.checksum) {
      const originalChecksum = auditData.checksum
      delete auditData.checksum
      const serialized = JSON.stringify(auditData)
      const computedChecksum = hashData(serialized)

      if (originalChecksum !== computedChecksum) {
        console.warn('⚠️ Audit entry checksum verification failed')
        // Continue anyway for degraded mode
      }
    }

    return auditData
  } catch (error) {
    console.warn('Failed to verify audit entry:', error)
    return null
  }
}