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

// Import cross-device services
import { deviceFingerprintService } from './deviceFingerprintService'
import { crossDeviceSessionService } from './crossDeviceSessionService'
import { realTimeSyncService } from './realTimeSyncService'
import { conflictResolutionService } from './conflictResolutionService'
import { crossDeviceDataService } from './crossDeviceDataService'

// Export cross-device sync services
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
  fuzzySearchService,
  // Cross-device services
  deviceFingerprintService,
  crossDeviceSessionService,
  realTimeSyncService,
  conflictResolutionService,
  crossDeviceDataService
}

// Export classes and types for direct usage
export { AuditService, RealtimeService }
export * from './userSettingsService'
export * from './mfaService'
export * from './supabaseService'
export * from './retellService'
export * from './chatService'

// Export cross-device service types and interfaces
export * from './deviceFingerprintService'
export * from './crossDeviceSessionService'
export * from './realTimeSyncService'
export * from './conflictResolutionService'
export * from './crossDeviceDataService'