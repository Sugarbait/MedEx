/**
 * Tenant-Aware Supabase Client Wrapper
 *
 * This wrapper automatically adds tenant_id filtering to all queries,
 * ensuring complete data isolation between MedEx and CareXPS.
 */

import { supabase, supabaseAdmin } from './supabase'
import { getCurrentTenantId } from './tenantConfig'

/**
 * Wrap a Supabase query builder to automatically filter by tenant_id
 */
function wrapQueryBuilder(builder: any): any {
  // Store original methods
  const originalSelect = builder.select
  const originalInsert = builder.insert
  const originalUpdate = builder.update
  const originalDelete = builder.delete
  const originalUpsert = builder.upsert

  // Override select to add tenant filter
  builder.select = function(...args: any[]) {
    const result = originalSelect.apply(this, args)
    return result.eq('tenant_id', getCurrentTenantId())
  }

  // Override insert to add tenant_id
  builder.insert = function(data: any, options?: any) {
    const tenantId = getCurrentTenantId()

    if (Array.isArray(data)) {
      // Multiple records
      const dataWithTenant = data.map(item => ({
        ...item,
        tenant_id: tenantId
      }))
      return originalInsert.call(this, dataWithTenant, options)
    } else {
      // Single record
      const dataWithTenant = {
        ...data,
        tenant_id: tenantId
      }
      return originalInsert.call(this, dataWithTenant, options)
    }
  }

  // Override update to filter by tenant
  builder.update = function(data: any, options?: any) {
    const result = originalUpdate.call(this, data, options)
    return result.eq('tenant_id', getCurrentTenantId())
  }

  // Override delete to filter by tenant
  builder.delete = function(options?: any) {
    const result = originalDelete.call(this, options)
    return result.eq('tenant_id', getCurrentTenantId())
  }

  // Override upsert to add tenant_id
  builder.upsert = function(data: any, options?: any) {
    const tenantId = getCurrentTenantId()

    if (Array.isArray(data)) {
      const dataWithTenant = data.map(item => ({
        ...item,
        tenant_id: tenantId
      }))
      return originalUpsert.call(this, dataWithTenant, options)
    } else {
      const dataWithTenant = {
        ...data,
        tenant_id: tenantId
      }
      return originalUpsert.call(this, dataWithTenant, options)
    }
  }

  return builder
}

/**
 * Tenant-aware Supabase client
 *
 * Usage (same as regular supabase client):
 * const { data } = await tenantSupabase.from('users').select('*')
 * // Automatically filtered by tenant_id = 'medex'
 */
export const tenantSupabase = {
  ...supabase,
  from: (table: string) => {
    const builder = supabase.from(table)
    return wrapQueryBuilder(builder)
  }
}

/**
 * Tenant-aware admin client
 */
export const tenantSupabaseAdmin = supabaseAdmin ? {
  ...supabaseAdmin,
  from: (table: string) => {
    const builder = supabaseAdmin.from(table)
    return wrapQueryBuilder(builder)
  }
} : null

/**
 * Get the regular supabase client without tenant filtering
 * Use this ONLY when you explicitly need cross-tenant access
 */
export function getUnfilteredSupabase() {
  console.warn('⚠️ Using unfiltered Supabase client - tenant isolation bypassed')
  return supabase
}
