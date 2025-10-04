/**
 * Tenant Configuration for Multi-Tenant Isolation
 *
 * MedEx uses tenant-based data isolation to separate data from CareXPS.
 * All database queries automatically filter by tenant_id.
 */

export const TENANT_CONFIG = {
  // Current tenant for this application
  CURRENT_TENANT: 'medex' as const,

  // All available tenants
  TENANTS: {
    CAREXPS: 'carexps',
    MEDEX: 'medex'
  } as const
} as const

/**
 * Get the current tenant ID for this application
 */
export function getCurrentTenantId(): string {
  const tenantId = TENANT_CONFIG.CURRENT_TENANT
  console.log(`🏢 [TENANT] getCurrentTenantId() called - Returning: "${tenantId}"`)
  return tenantId
}

/**
 * Helper to add tenant filter to Supabase queries
 *
 * Usage:
 * const query = supabase.from('users').select('*')
 * const filteredQuery = withTenantFilter(query)
 */
export function withTenantFilter<T>(query: any): any {
  return query.eq('tenant_id', getCurrentTenantId())
}

/**
 * Helper to add tenant_id to data being inserted
 *
 * Usage:
 * const data = withTenantId({ name: 'John', email: 'john@example.com' })
 * await supabase.from('users').insert(data)
 */
export function withTenantId<T extends Record<string, any>>(data: T): T & { tenant_id: string } {
  return {
    ...data,
    tenant_id: getCurrentTenantId()
  }
}

/**
 * Helper to add tenant_id to multiple records
 */
export function withTenantIds<T extends Record<string, any>>(data: T[]): Array<T & { tenant_id: string }> {
  return data.map(item => withTenantId(item))
}
