// Service instances for easy importing
import { UserSettingsService } from './userSettingsService'
import { AuditService } from './auditService'
import { RealtimeService } from './realtimeService'
import { retellService } from './retellService'
import { chatService } from './chatService'
import { avatarStorageService } from './avatarStorageService'

// Create singleton instances
export const userSettingsService = new UserSettingsService()
export const auditService = new AuditService()
export const realtimeService = new RealtimeService()

// Export services
export { retellService, chatService, avatarStorageService }

// Export classes for direct usage
export { UserSettingsService, AuditService, RealtimeService }
export * from './supabaseService'
export * from './retellService'
export * from './chatService'