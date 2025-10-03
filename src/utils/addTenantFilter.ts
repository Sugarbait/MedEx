/**
 * Utility to add tenant_id filtering to Supabase queries
 *
 * This ensures all queries automatically filter by tenant_id = 'medex'
 * to maintain complete data isolation from CareXPS.
 */

const MEDEX_TENANT_ID = 'medex'

/**
 * Add tenant filter to any Supabase query builder
 *
 * Usage:
 * const query = supabase.from('users').select('*')
 * const filtered = addTenantFilter(query)
 */
export function addTenantFilter<T>(queryBuilder: T): T {
  // Check if the query builder has an 'eq' method (standard Supabase query builder)
  if (queryBuilder && typeof (queryBuilder as any).eq === 'function') {
    return (queryBuilder as any).eq('tenant_id', MEDEX_TENANT_ID) as T
  }

  return queryBuilder
}

/**
 * Add tenant_id to data being inserted/updated
 *
 * Usage:
 * const data = addTenantId({ name: 'John', email: 'john@example.com' })
 * await supabase.from('users').insert(data)
 */
export function addTenantId<T extends Record<string, any>>(data: T): T & { tenant_id: string } {
  return {
    ...data,
    tenant_id: MEDEX_TENANT_ID
  }
}

/**
 * Add tenant_id to multiple records
 */
export function addTenantIds<T extends Record<string, any>>(data: T[]): Array<T & { tenant_id: string }> {
  return data.map(item => addTenantId(item))
}

/**
 * Get the current tenant ID
 */
export function getTenantId(): string {
  return MEDEX_TENANT_ID
}
