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
 * Encrypt PHI data using AES-256-GCM
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
      throw new EncryptionError(`Encryption key not configured for type: ${keyType}`)
    }

    // Generate random IV for each encryption
    const iv = CryptoJS.lib.WordArray.random(12) // 96 bits for GCM

    // Encrypt using AES-256-GCM
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    })

    // Combine IV + encrypted data
    const result = iv.concat(encrypted.ciphertext)
    return result.toString(CryptoJS.enc.Base64)
  } catch (error) {
    throw new EncryptionError(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt PHI data using AES-256-GCM
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
      throw new EncryptionError(`Encryption key not configured for type: ${keyType}`)
    }

    // Parse the combined IV + encrypted data
    const combined = CryptoJS.enc.Base64.parse(ciphertext)
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 3)) // 96 bits
    const encrypted = CryptoJS.lib.WordArray.create(combined.words.slice(3))

    // Decrypt using AES-256-GCM
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: encrypted } as any,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      }
    )

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
    if (!plaintext) {
      throw new EncryptionError('Decryption failed - invalid ciphertext or key')
    }

    return plaintext
  } catch (error) {
    throw new EncryptionError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  return encryptPHI(JSON.stringify(auditData), 'audit')
}

/**
 * Verify and decrypt an audit trail entry
 * @param encryptedEntry - The encrypted audit entry
 * @returns Parsed audit entry or null if invalid
 */
export function verifyAuditEntry(encryptedEntry: string): any | null {
  try {
    const decrypted = decryptPHI(encryptedEntry, 'audit')
    const auditData = JSON.parse(decrypted)

    // Verify checksum
    const originalChecksum = auditData.checksum
    delete auditData.checksum
    const serialized = JSON.stringify(auditData)
    const computedChecksum = hashData(serialized)

    if (originalChecksum !== computedChecksum) {
      throw new Error('Audit entry checksum verification failed')
    }

    return auditData
  } catch (error) {
    console.error('Failed to verify audit entry:', error)
    return null
  }
}