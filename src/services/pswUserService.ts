import { supabase } from '@/config/supabase'
import { ServiceResponse } from '@/types/supabase'

export interface PSWUser {
  id: string
  psw_id: string
  company_id: string
  nexasync_organization_id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  tenant_id: string
  created_at: string
  updated_at: string
  last_login: string | null
  metadata?: Record<string, any>
}

export interface PSWCompany {
  id: string
  company_name: string
  nexasync_organization_id: string
  tenant_id: string
  created_at: string
  updated_at: string
  is_active: boolean
  metadata?: Record<string, any>
}

export interface PSWUserStats {
  total: number
  active: number
  inactive: number
  lastUpdated: string
}

/**
 * Get all PSW users for a company (company-isolated)
 */
export const getPSWUsersByCompany = async (companyId: string): Promise<ServiceResponse<PSWUser[]>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    const { data, error } = await supabase
      .from('psw_users')
      .select('*')
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching PSW users:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: data || []
    }
  } catch (error: any) {
    console.error('Exception in getPSWUsersByCompany:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get paginated PSW users for a company
 */
export const getPSWUsersPagedByCompany = async (
  companyId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResponse<{ users: PSWUser[]; total: number; totalPages: number }>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    const offset = (page - 1) * pageSize

    // Get total count
    const { count } = await supabase
      .from('psw_users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')

    // Get paginated data
    const { data, error } = await supabase
      .from('psw_users')
      .select('*')
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Error fetching paginated PSW users:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      status: 'success',
      data: {
        users: data || [],
        total,
        totalPages
      }
    }
  } catch (error: any) {
    console.error('Exception in getPSWUsersPagedByCompany:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Search PSW users within a company
 */
export const searchPSWUsersByCompany = async (
  companyId: string,
  query: string
): Promise<ServiceResponse<PSWUser[]>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    if (!query || query.trim().length === 0) {
      // If no query, return all users
      return getPSWUsersByCompany(companyId)
    }

    const searchTerm = `%${query.toLowerCase()}%`

    const { data, error } = await supabase
      .from('psw_users')
      .select('*')
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error searching PSW users:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: data || []
    }
  } catch (error: any) {
    console.error('Exception in searchPSWUsersByCompany:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get PSW user stats for a company
 */
export const getPSWUserStatsByCompany = async (companyId: string): Promise<ServiceResponse<PSWUserStats>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    const { data, error } = await supabase
      .from('psw_users')
      .select('status')
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')

    if (error) {
      console.error('Error fetching PSW stats:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    const users = data || []
    const stats: PSWUserStats = {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
      lastUpdated: new Date().toISOString()
    }

    return {
      status: 'success',
      data: stats
    }
  } catch (error: any) {
    console.error('Exception in getPSWUserStatsByCompany:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get a single PSW user by ID with company validation
 */
export const getPSWUserById = async (userId: string, companyId: string): Promise<ServiceResponse<PSWUser>> => {
  try {
    if (!userId || !companyId) {
      return {
        status: 'error',
        error: 'User ID and Company ID are required',
        data: null
      }
    }

    const { data, error } = await supabase
      .from('psw_users')
      .select('*')
      .eq('id', userId)
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')
      .single()

    if (error) {
      console.error('Error fetching PSW user:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: data || null
    }
  } catch (error: any) {
    console.error('Exception in getPSWUserById:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get all accessible PSW companies for current user
 */
export const getPSWCompanies = async (): Promise<ServiceResponse<PSWCompany[]>> => {
  try {
    const { data, error } = await supabase
      .from('psw_companies')
      .select('*')
      .eq('tenant_id', 'medex')
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    if (error) {
      console.error('Error fetching PSW companies:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: data || []
    }
  } catch (error: any) {
    console.error('Exception in getPSWCompanies:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get a single PSW company by ID
 */
export const getPSWCompanyById = async (companyId: string): Promise<ServiceResponse<PSWCompany>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    const { data, error } = await supabase
      .from('psw_companies')
      .select('*')
      .eq('id', companyId)
      .eq('tenant_id', 'medex')
      .single()

    if (error) {
      console.error('Error fetching PSW company:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: data || null
    }
  } catch (error: any) {
    console.error('Exception in getPSWCompanyById:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}

/**
 * Get count of PSW users for a company
 */
export const getPSWUserCountByCompany = async (companyId: string): Promise<ServiceResponse<number>> => {
  try {
    if (!companyId) {
      return {
        status: 'error',
        error: 'Company ID is required',
        data: null
      }
    }

    const { count, error } = await supabase
      .from('psw_users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('tenant_id', 'medex')

    if (error) {
      console.error('Error counting PSW users:', error)
      return {
        status: 'error',
        error: error.message,
        data: null
      }
    }

    return {
      status: 'success',
      data: count || 0
    }
  } catch (error: any) {
    console.error('Exception in getPSWUserCountByCompany:', error)
    return {
      status: 'error',
      error: error.message,
      data: null
    }
  }
}
