// UUID Mapping Layer - Safe conversion between string IDs and UUIDs
// This maintains compatibility with existing app code while using proper UUIDs in the database

import { v5 as uuidv5 } from 'uuid'

// Namespace UUID for CareXPS application (randomly generated, consistent)
const CAREXPS_NAMESPACE = '6ba7b814-9dad-11d1-80b4-00c04fd430c8'

// Predefined mappings for known users (deterministic UUIDs)
const KNOWN_USER_MAPPINGS: Record<string, string> = {
  'super-user-456': '550e8400-e29b-41d4-a716-446655440001',
  'pierre-user-789': '550e8400-e29b-41d4-a716-446655440002',
  'guest-user-456': '550e8400-e29b-41d4-a716-446655440003',
  'dynamic-pierre-user': '550e8400-e29b-41d4-a716-446655440004'
}

// Reverse mapping for UUID to string ID lookup
const UUID_TO_STRING_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_USER_MAPPINGS).map(([stringId, uuid]) => [uuid, stringId])
)

export class UUIDMappingService {
  /**
   * Convert string ID to UUID (for database operations)
   */
  static stringToUUID(stringId: string): string {
    // Check if we have a predefined mapping
    if (KNOWN_USER_MAPPINGS[stringId]) {
      return KNOWN_USER_MAPPINGS[stringId]
    }

    // For unknown string IDs, generate deterministic UUID using v5
    return uuidv5(stringId, CAREXPS_NAMESPACE)
  }

  /**
   * Convert UUID to string ID (for app operations)
   */
  static uuidToString(uuid: string): string {
    // Check reverse mapping first
    if (UUID_TO_STRING_MAPPING[uuid]) {
      return UUID_TO_STRING_MAPPING[uuid]
    }

    // For unknown UUIDs, return the UUID itself
    return uuid
  }

  /**
   * Check if a string is already a valid UUID
   */
  static isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * Smart ID converter - handles both string IDs and existing UUIDs
   */
  static toUUID(id: string): string {
    if (this.isValidUUID(id)) {
      return id // Already a UUID
    }
    return this.stringToUUID(id) // Convert string to UUID
  }

  /**
   * Smart ID converter - handles both UUIDs and string IDs
   */
  static toStringID(id: string): string {
    if (this.isValidUUID(id)) {
      return this.uuidToString(id) // Convert UUID to string
    }
    return id // Already a string ID
  }

  /**
   * Get all known user mappings
   */
  static getAllMappings(): Record<string, string> {
    return { ...KNOWN_USER_MAPPINGS }
  }

  /**
   * Add a new mapping (for dynamic users)
   */
  static addMapping(stringId: string, uuid?: string): string {
    const mappedUUID = uuid || this.stringToUUID(stringId)
    KNOWN_USER_MAPPINGS[stringId] = mappedUUID
    UUID_TO_STRING_MAPPING[mappedUUID] = stringId
    return mappedUUID
  }
}

// Export for convenience
export const { stringToUUID, uuidToString, toUUID, toStringID } = UUIDMappingService

// Debug logging
console.log('🔧 UUID Mapping Service initialized with mappings:', {
  'super-user-456': KNOWN_USER_MAPPINGS['super-user-456'],
  'pierre-user-789': KNOWN_USER_MAPPINGS['pierre-user-789'],
  'guest-user-456': KNOWN_USER_MAPPINGS['guest-user-456']
})