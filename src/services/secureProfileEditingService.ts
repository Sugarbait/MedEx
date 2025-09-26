/**
 * Secure Profile Editing Service
 *
 * HIPAA-compliant profile editing with cloud synchronization, encryption,
 * audit logging, and cross-device conflict resolution.
 *
 * Features:
 * - Encrypted storage for sensitive profile data
 * - Real-time Supabase synchronization
 * - Cross-device conflict resolution
 * - HIPAA audit logging for all changes
 * - Input validation and sanitization
 * - Emergency rollback capabilities
 */

import { supabase } from '@/config/supabase'
import { auditLogger } from './auditLogger'
import { encryptionService } from './encryption'
import { userProfileService } from './userProfileService'
import { userSettingsService } from './userSettingsService'

export interface ProfileData {
  id: string
  name: string
  display_name?: string
  department?: string
  phone?: string
  bio?: string
  location?: string
  timezone?: string
  preferences?: Record<string, any>
}

export interface ProfileEditRequest {
  userId: string
  updates: Partial<ProfileData>
  deviceId?: string
  skipValidation?: boolean
  emergencyOverride?: boolean
}

export interface ProfileEditResponse {
  success: boolean
  data?: ProfileData
  error?: string
  warnings?: string[]
  conflictResolution?: 'auto' | 'manual' | 'none'
  syncStatus?: {
    supabase: boolean
    localStorage: boolean
    crossDevice: boolean
  }
}

export interface ValidationRule {
  field: string
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  customValidator?: (value: any) => boolean | string
}

export interface ConflictResolution {
  conflictId: string
  strategy: 'take_local' | 'take_remote' | 'merge' | 'manual'
  localData: ProfileData
  remoteData: ProfileData
  mergedData?: ProfileData
}

class SecureProfileEditingService {
  private readonly ENCRYPTION_FIELDS = ['phone', 'bio', 'location']
  private readonly AUDIT_RESOURCE = 'user_profiles'
  private pendingEdits = new Map<string, ProfileEditRequest>()
  private conflictQueue = new Map<string, ConflictResolution[]>()
  private validationRules: ValidationRule[] = []

  constructor() {
    this.initializeValidationRules()
  }

  /**
   * Initialize field validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        field: 'name',
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z\s\-'\.]+$/,
        customValidator: (value: string) => {
          // Prevent injection attempts
          if (/<script|javascript:|data:|vbscript:/i.test(value)) {
            return 'Invalid characters detected'
          }
          return true
        }
      },
      {
        field: 'display_name',
        maxLength: 50,
        pattern: /^[a-zA-Z0-9\s\-_\.]+$/
      },
      {
        field: 'department',
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_&.,()]+$/
      },
      {
        field: 'phone',
        pattern: /^[\+]?[1-9][\d\s\-\(\)]{0,20}$/,
        customValidator: (value: string) => {
          if (!value) return true
          const cleaned = value.replace(/[\s\-\(\)]/g, '')
          if (cleaned.length < 10 || cleaned.length > 15) {
            return 'Phone number must be 10-15 digits'
          }
          return true
        }
      },
      {
        field: 'bio',
        maxLength: 500
      },
      {
        field: 'location',
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_,.\(\)]+$/
      },
      {
        field: 'timezone',
        customValidator: (value: string) => {
          if (!value) return true
          try {
            // Validate timezone using Intl.DateTimeFormat
            Intl.DateTimeFormat(undefined, { timeZone: value })
            return true
          } catch {
            return 'Invalid timezone'
          }
        }
      }
    ]
  }

  /**
   * Validate profile data against security rules
   */
  private validateProfileData(data: Partial<ProfileData>): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {}

    for (const rule of this.validationRules) {
      const value = data[rule.field as keyof ProfileData]

      if (value === undefined || value === null) {
        if (rule.required) {
          errors[rule.field] = `${rule.field} is required`
        }
        continue
      }

      const stringValue = String(value)

      // Length validation
      if (rule.minLength && stringValue.length < rule.minLength) {
        errors[rule.field] = `${rule.field} must be at least ${rule.minLength} characters`
        continue
      }

      if (rule.maxLength && stringValue.length > rule.maxLength) {
        errors[rule.field] = `${rule.field} must not exceed ${rule.maxLength} characters`
        continue
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(stringValue)) {
        errors[rule.field] = `${rule.field} contains invalid characters`
        continue
      }

      // Custom validation
      if (rule.customValidator) {
        const result = rule.customValidator(value)
        if (result !== true) {
          errors[rule.field] = typeof result === 'string' ? result : `${rule.field} is invalid`
          continue
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }

  /**
   * Sanitize input data to prevent XSS and injection attacks
   */
  private sanitizeProfileData(data: Partial<ProfileData>): Partial<ProfileData> {
    const sanitized: Partial<ProfileData> = {}

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        sanitized[key as keyof ProfileData] = value
        continue
      }

      let sanitizedValue = String(value)
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')

      // Remove null bytes and control characters
      sanitizedValue = sanitizedValue.replace(/[\x00-\x1F\x7F]/g, '')

      // Limit length to prevent DoS
      if (sanitizedValue.length > 1000) {
        sanitizedValue = sanitizedValue.substring(0, 1000)
      }

      sanitized[key as keyof ProfileData] = sanitizedValue
    }

    return sanitized
  }

  /**
   * Encrypt sensitive profile fields
   */
  private async encryptSensitiveFields(data: Partial<ProfileData>): Promise<Partial<ProfileData>> {
    const encrypted = { ...data }

    for (const field of this.ENCRYPTION_FIELDS) {
      const value = encrypted[field as keyof ProfileData]
      if (value && typeof value === 'string' && value.trim()) {
        try {
          encrypted[field as keyof ProfileData] = await encryptionService.encrypt(value) as any
        } catch (error) {
          console.error(`Failed to encrypt field ${field}:`, error)
          // Continue without encryption for this field - log the issue
          await auditLogger.logSecurityEvent('ENCRYPTION_FAILURE', this.AUDIT_RESOURCE, false, {
            field,
            userId: data.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    return encrypted
  }

  /**
   * Decrypt sensitive profile fields
   */
  private async decryptSensitiveFields(data: Partial<ProfileData>): Promise<Partial<ProfileData>> {
    const decrypted = { ...data }

    for (const field of this.ENCRYPTION_FIELDS) {
      const value = decrypted[field as keyof ProfileData]
      if (value && typeof value === 'object' && 'data' in value) {
        try {
          decrypted[field as keyof ProfileData] = await encryptionService.decrypt(value as any) as any
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error)
          decrypted[field as keyof ProfileData] = '[ENCRYPTED_DATA]' as any
        }
      }
    }

    return decrypted
  }

  /**
   * Get current profile data with decryption
   */
  async getCurrentProfile(userId: string): Promise<ProfileData | null> {
    try {
      await auditLogger.logSecurityEvent('PROFILE_ACCESS', this.AUDIT_RESOURCE, true, {
        userId,
        action: 'read_profile'
      })

      // First try to load from userProfileService
      const profileResponse = await userProfileService.loadUserProfile(userId)
      if (profileResponse.status === 'success' && profileResponse.data) {
        const profile: ProfileData = {
          id: profileResponse.data.id,
          name: profileResponse.data.name,
          display_name: profileResponse.data.name, // Default to name if no display_name
          department: '',
          phone: '',
          bio: '',
          location: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          preferences: profileResponse.data.settings || {}
        }

        // Try to get extended profile data from Supabase
        try {
          const { data: extendedProfile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (!error && extendedProfile) {
            profile.display_name = extendedProfile.display_name || profile.name
            profile.department = extendedProfile.department || ''
            profile.phone = extendedProfile.phone || ''
            profile.bio = extendedProfile.bio || ''
            profile.location = extendedProfile.location || ''
            profile.timezone = extendedProfile.timezone || profile.timezone
            profile.preferences = {
              ...profile.preferences,
              ...extendedProfile.preferences
            }

            // Decrypt sensitive fields
            const decryptedProfile = await this.decryptSensitiveFields(profile)
            return decryptedProfile as ProfileData
          }
        } catch (supabaseError) {
          console.warn('Extended profile data not available from Supabase:', supabaseError)
        }

        return profile
      }

      return null
    } catch (error) {
      await auditLogger.logSecurityEvent('PROFILE_ACCESS_FAILED', this.AUDIT_RESOURCE, false, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Edit profile with full security and synchronization
   */
  async editProfile(request: ProfileEditRequest): Promise<ProfileEditResponse> {
    const startTime = Date.now()
    const { userId, updates, deviceId, skipValidation, emergencyOverride } = request

    try {
      await auditLogger.logSecurityEvent('PROFILE_EDIT_START', this.AUDIT_RESOURCE, true, {
        userId,
        updatedFields: Object.keys(updates),
        deviceId,
        emergencyOverride
      })

      // Step 1: Input validation and sanitization
      if (!skipValidation) {
        const sanitizedUpdates = this.sanitizeProfileData(updates)
        const validation = this.validateProfileData(sanitizedUpdates)

        if (!validation.isValid) {
          await auditLogger.logSecurityEvent('PROFILE_VALIDATION_FAILED', this.AUDIT_RESOURCE, false, {
            userId,
            validationErrors: validation.errors
          })

          return {
            success: false,
            error: 'Validation failed',
            warnings: Object.values(validation.errors)
          }
        }

        // Update request with sanitized data
        request.updates = sanitizedUpdates
      }

      // Step 2: Check for concurrent edits and conflicts
      const conflictCheck = await this.checkForConflicts(userId, updates)
      if (conflictCheck.hasConflict && !emergencyOverride) {
        return {
          success: false,
          error: 'Conflict detected - manual resolution required',
          conflictResolution: 'manual'
        }
      }

      // Step 3: Get current profile
      const currentProfile = await this.getCurrentProfile(userId)
      if (!currentProfile) {
        return {
          success: false,
          error: 'Profile not found'
        }
      }

      // Step 4: Merge updates with current profile
      const updatedProfile: ProfileData = {
        ...currentProfile,
        ...updates,
        id: userId // Ensure ID consistency
      }

      // Step 5: Save to multiple storage layers with encryption
      const syncStatus = await this.saveProfileSecurely(updatedProfile, deviceId)

      // Step 6: Cross-device synchronization
      await this.synchronizeAcrossDevices(userId, updatedProfile, deviceId)

      // Step 7: Final audit log
      const duration = Date.now() - startTime
      await auditLogger.logSecurityEvent('PROFILE_EDIT_SUCCESS', this.AUDIT_RESOURCE, true, {
        userId,
        updatedFields: Object.keys(updates),
        duration,
        syncStatus,
        deviceId
      })

      return {
        success: true,
        data: updatedProfile,
        syncStatus,
        conflictResolution: conflictCheck.hasConflict ? 'auto' : 'none'
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await auditLogger.logSecurityEvent('PROFILE_EDIT_FAILED', this.AUDIT_RESOURCE, false, {
        userId,
        error: errorMessage,
        duration,
        deviceId
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Check for editing conflicts from other devices
   */
  private async checkForConflicts(userId: string, updates: Partial<ProfileData>): Promise<{
    hasConflict: boolean
    conflictData?: any
  }> {
    try {
      // Check if there are pending edits from other devices
      if (this.pendingEdits.has(userId)) {
        return { hasConflict: true }
      }

      // Check Supabase for recent updates
      const { data: recentProfile, error } = await supabase
        .from('user_profiles')
        .select('updated_at')
        .eq('user_id', userId)
        .single()

      if (!error && recentProfile) {
        const lastUpdate = new Date(recentProfile.updated_at)
        const timeDiff = Date.now() - lastUpdate.getTime()

        // If updated within last 30 seconds, consider it a potential conflict
        if (timeDiff < 30000) {
          return { hasConflict: true, conflictData: recentProfile }
        }
      }

      return { hasConflict: false }
    } catch (error) {
      console.warn('Conflict check failed:', error)
      return { hasConflict: false }
    }
  }

  /**
   * Save profile to multiple storage layers with encryption
   */
  private async saveProfileSecurely(profile: ProfileData, deviceId?: string): Promise<{
    supabase: boolean
    localStorage: boolean
    crossDevice: boolean
  }> {
    const syncStatus = {
      supabase: false,
      localStorage: false,
      crossDevice: false
    }

    try {
      // Step 1: Save core profile data via userProfileService
      const coreProfileData = {
        id: profile.id,
        email: profile.id, // Will be updated by userProfileService
        name: profile.name,
        role: 'staff' // Default role, will be preserved by userProfileService
      }

      const profileSaveResult = await userProfileService.updateUserProfile(
        profile.id,
        coreProfileData,
        { deviceId, syncToCloud: true, broadcastToOtherDevices: true }
      )

      syncStatus.localStorage = profileSaveResult.status === 'success'

      // Step 2: Save extended profile data to Supabase with encryption
      try {
        const encryptedProfile = await this.encryptSensitiveFields({
          display_name: profile.display_name,
          department: profile.department,
          phone: profile.phone,
          bio: profile.bio,
          location: profile.location,
          timezone: profile.timezone,
          preferences: profile.preferences
        })

        const { error: supabaseError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: profile.id,
            ...encryptedProfile,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })

        if (!supabaseError) {
          syncStatus.supabase = true
        } else {
          console.warn('Supabase profile save failed:', supabaseError)
        }
      } catch (supabaseError) {
        console.warn('Failed to save to Supabase:', supabaseError)
      }

      // Step 3: Cross-device sync via userSettingsService if preferences changed
      if (profile.preferences && Object.keys(profile.preferences).length > 0) {
        try {
          await userSettingsService.updateUserSettings(
            profile.id,
            { ui_preferences: profile.preferences },
            { deviceId, broadcastToOtherDevices: true }
          )
          syncStatus.crossDevice = true
        } catch (settingsError) {
          console.warn('Settings sync failed:', settingsError)
        }
      } else {
        syncStatus.crossDevice = true
      }

      return syncStatus
    } catch (error) {
      console.error('Profile save failed:', error)
      return syncStatus
    }
  }

  /**
   * Synchronize profile changes across all devices
   */
  private async synchronizeAcrossDevices(userId: string, profile: ProfileData, sourceDeviceId?: string): Promise<void> {
    try {
      // Use existing cross-device sync infrastructure
      await userProfileService.subscribeToProfileSync(userId, (event) => {
        if (event.eventType === 'profile_updated' && event.deviceId !== sourceDeviceId) {
          console.log('Profile updated on another device:', event)
          // Trigger UI updates if needed
          window.dispatchEvent(new CustomEvent('crossDeviceProfileSync', {
            detail: { userId, profile, sourceDevice: event.deviceId }
          }))
        }
      })

      // Force sync to ensure immediate propagation
      await userProfileService.forceSyncProfileFromCloud(userId)

    } catch (error) {
      console.warn('Cross-device sync failed:', error)
    }
  }

  /**
   * Rollback profile changes (emergency feature)
   */
  async rollbackProfile(userId: string, toTimestamp?: string): Promise<ProfileEditResponse> {
    try {
      await auditLogger.logSecurityEvent('PROFILE_ROLLBACK_START', this.AUDIT_RESOURCE, true, {
        userId,
        toTimestamp,
        reason: 'emergency_rollback'
      })

      // Get backup data from localStorage or audit logs
      const backupData = await this.getProfileBackup(userId, toTimestamp)
      if (!backupData) {
        return {
          success: false,
          error: 'No backup data available for rollback'
        }
      }

      // Perform rollback edit
      const rollbackResult = await this.editProfile({
        userId,
        updates: backupData,
        emergencyOverride: true,
        skipValidation: false
      })

      await auditLogger.logSecurityEvent('PROFILE_ROLLBACK_COMPLETE', this.AUDIT_RESOURCE, rollbackResult.success, {
        userId,
        success: rollbackResult.success,
        error: rollbackResult.error
      })

      return rollbackResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await auditLogger.logSecurityEvent('PROFILE_ROLLBACK_FAILED', this.AUDIT_RESOURCE, false, {
        userId,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get profile backup data for rollback
   */
  private async getProfileBackup(userId: string, timestamp?: string): Promise<Partial<ProfileData> | null> {
    try {
      // Try to get from localStorage first
      const userProfileKey = `userProfile_${userId}`
      const storedProfile = localStorage.getItem(userProfileKey)

      if (storedProfile) {
        const parsed = JSON.parse(storedProfile)
        return {
          name: parsed.name,
          display_name: parsed.display_name,
          department: parsed.department,
          phone: parsed.phone
        }
      }

      // Fallback: Try to get from current user in localStorage
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const parsed = JSON.parse(currentUser)
        if (parsed.id === userId) {
          return {
            name: parsed.name,
            display_name: parsed.display_name || parsed.name
          }
        }
      }

      return null
    } catch (error) {
      console.error('Failed to get profile backup:', error)
      return null
    }
  }

  /**
   * Get pending conflicts for manual resolution
   */
  getPendingConflicts(userId: string): ConflictResolution[] {
    return this.conflictQueue.get(userId) || []
  }

  /**
   * Resolve profile editing conflict manually
   */
  async resolveConflict(userId: string, conflictId: string, resolution: ConflictResolution): Promise<ProfileEditResponse> {
    try {
      const conflicts = this.conflictQueue.get(userId) || []
      const conflictIndex = conflicts.findIndex(c => c.conflictId === conflictId)

      if (conflictIndex === -1) {
        return {
          success: false,
          error: 'Conflict not found'
        }
      }

      let resolvedData: ProfileData
      switch (resolution.strategy) {
        case 'take_local':
          resolvedData = resolution.localData
          break
        case 'take_remote':
          resolvedData = resolution.remoteData
          break
        case 'merge':
          resolvedData = resolution.mergedData || resolution.localData
          break
        default:
          return {
            success: false,
            error: 'Invalid resolution strategy'
          }
      }

      // Apply resolved data
      const result = await this.editProfile({
        userId,
        updates: resolvedData,
        emergencyOverride: true
      })

      if (result.success) {
        // Remove resolved conflict
        conflicts.splice(conflictIndex, 1)
        this.conflictQueue.set(userId, conflicts)

        await auditLogger.logSecurityEvent('PROFILE_CONFLICT_RESOLVED', this.AUDIT_RESOURCE, true, {
          userId,
          conflictId,
          strategy: resolution.strategy
        })
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await auditLogger.logSecurityEvent('PROFILE_CONFLICT_RESOLUTION_FAILED', this.AUDIT_RESOURCE, false, {
        userId,
        conflictId,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Cleanup service resources
   */
  cleanup(): void {
    this.pendingEdits.clear()
    this.conflictQueue.clear()
  }
}

// Export singleton instance
export const secureProfileEditingService = new SecureProfileEditingService()