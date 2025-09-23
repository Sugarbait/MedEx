/**
 * Patient ID Service
 * Generates consistent Patient IDs based on phone numbers
 * Ensures the same phone number always gets the same Patient ID
 */

interface PatientRecord {
  patientId: string
  phoneNumber: string
  createdAt: string
  lastSeen: string
}

class PatientIdService {
  private static instance: PatientIdService | null = null
  private readonly STORAGE_KEY = 'patient_id_mapping'
  private patientMap = new Map<string, PatientRecord>()

  private constructor() {
    this.loadFromStorage()
  }

  static getInstance(): PatientIdService {
    if (!PatientIdService.instance) {
      PatientIdService.instance = new PatientIdService()
    }
    return PatientIdService.instance
  }

  /**
   * Normalize phone number to a consistent format for matching
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '')

    // Handle common formats:
    // +1XXXXXXXXXX -> XXXXXXXXXX
    // 1XXXXXXXXXX -> XXXXXXXXXX
    // XXXXXXXXXX -> XXXXXXXXXX
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return digitsOnly.substring(1) // Remove leading 1
    }

    if (digitsOnly.length === 10) {
      return digitsOnly
    }

    // For international numbers or other formats, return as-is
    return digitsOnly
  }

  /**
   * Generate a Patient ID from phone number using a consistent algorithm
   */
  private generatePatientId(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber)

    // Create a simple hash-based ID that's always the same for the same number
    let hash = 0
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    // Convert to positive number and create a patient ID
    const positiveHash = Math.abs(hash)
    const patientId = `PT${positiveHash.toString().padStart(8, '0')}`

    return patientId
  }

  /**
   * Get or create a Patient ID for a phone number
   */
  getPatientId(phoneNumber: string): string {
    if (!phoneNumber) {
      return 'PT00000000' // Default for empty phone numbers
    }

    const normalized = this.normalizePhoneNumber(phoneNumber)

    // Check if we already have a mapping for this number
    if (this.patientMap.has(normalized)) {
      const record = this.patientMap.get(normalized)!
      // Update last seen
      record.lastSeen = new Date().toISOString()
      this.saveToStorage()
      return record.patientId
    }

    // Generate new Patient ID
    const patientId = this.generatePatientId(phoneNumber)
    const now = new Date().toISOString()

    const record: PatientRecord = {
      patientId,
      phoneNumber: normalized,
      createdAt: now,
      lastSeen: now
    }

    this.patientMap.set(normalized, record)
    this.saveToStorage()

    console.log(`Generated new Patient ID: ${patientId} for phone: [REDACTED] (normalized: [REDACTED])`)

    return patientId
  }

  /**
   * Find Patient ID by phone number (returns null if not found)
   */
  findPatientId(phoneNumber: string): string | null {
    if (!phoneNumber) return null

    const normalized = this.normalizePhoneNumber(phoneNumber)
    const record = this.patientMap.get(normalized)

    return record ? record.patientId : null
  }

  /**
   * Get all patient records
   */
  getAllPatients(): PatientRecord[] {
    return Array.from(this.patientMap.values())
  }

  /**
   * Get patient record by phone number
   */
  getPatientRecord(phoneNumber: string): PatientRecord | null {
    if (!phoneNumber) return null

    const normalized = this.normalizePhoneNumber(phoneNumber)
    return this.patientMap.get(normalized) || null
  }

  /**
   * Load patient mappings from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.patientMap = new Map(Object.entries(data))
        console.log(`Loaded ${this.patientMap.size} patient ID mappings from storage`)
      }
    } catch (error) {
      console.error('Error loading patient ID mappings:', error)
      this.patientMap = new Map()
    }
  }

  /**
   * Save patient mappings to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.patientMap)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving patient ID mappings:', error)
    }
  }

  /**
   * Clear all patient mappings (for testing/reset purposes)
   */
  clearAllMappings(): void {
    this.patientMap.clear()
    localStorage.removeItem(this.STORAGE_KEY)
    console.log('Cleared all patient ID mappings')
  }

  /**
   * Get statistics about patient mappings
   */
  getStats() {
    return {
      totalPatients: this.patientMap.size,
      oldestRecord: Array.from(this.patientMap.values()).reduce((oldest, record) =>
        !oldest || record.createdAt < oldest.createdAt ? record : oldest, null as PatientRecord | null
      ),
      newestRecord: Array.from(this.patientMap.values()).reduce((newest, record) =>
        !newest || record.createdAt > newest.createdAt ? record : newest, null as PatientRecord | null
      )
    }
  }
}

// Export singleton instance
export const patientIdService = PatientIdService.getInstance()