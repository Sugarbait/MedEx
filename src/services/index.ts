// Service instances for easy importing
import { userSettingsService as userSettingsServiceInstance } from './userSettingsService'
import { mfaService as mfaServiceInstance } from './mfaService'
import { AuditService } from './auditService'
import { RealtimeService } from './realtimeService'
import { retellService } from './retellService'
import { chatService } from './chatService'
import { avatarStorageService } from './avatarStorageService'
import { currencyService } from './currencyService'
import { twilioCostService } from './twilioCostService'
import { pdfExportService } from './pdfExportService'
import { patientIdService } from './patientIdService'
import { fuzzySearchService } from './fuzzySearchService'

// Export service instances
export const userSettingsService = userSettingsServiceInstance
export const mfaService = mfaServiceInstance

// Create other singleton instances
export const auditService = new AuditService()
export const realtimeService = new RealtimeService()

// Export services
export {
  retellService,
  chatService,
  avatarStorageService,
  currencyService,
  twilioCostService,
  pdfExportService,
  patientIdService,
  fuzzySearchService
}

// Export classes and types for direct usage
export { AuditService, RealtimeService }
export * from './userSettingsService'
export * from './mfaService'
export * from './supabaseService'
export * from './retellService'
export * from './chatService'