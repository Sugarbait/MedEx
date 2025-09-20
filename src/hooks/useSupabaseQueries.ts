import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSupabase } from '@/contexts/SupabaseContext'
import { PatientService } from '@/services/supabaseService'
import { UserSettingsService } from '@/services/userSettingsService'
import { RealtimeService } from '@/services/realtimeService'
import { AuditService } from '@/services/auditService'
import { UserSettings, DecryptedPatient, ServiceResponse } from '@/types/supabase'

/**
 * Custom hooks for Supabase data management with React Query
 */

// User Settings Hooks
export const useUserSettings = () => {
  const { user } = useSupabase()

  return useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      const response = await UserSettingsService.getUserSettingsWithCache(user.id)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  })
}

export const useUpdateUserSettings = () => {
  const { user, updateSettings } = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      const response = await updateSettings(settings)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(['user-settings', user?.id], data)
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
    }
  })
}

export const useSyncSettings = () => {
  const { user, syncSettings } = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await syncSettings()
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-settings', user?.id], data)
    }
  })
}

// Patient Management Hooks
export const usePatients = (searchQuery?: string) => {
  return useQuery({
    queryKey: ['patients', searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        const response = await PatientService.searchPatients(searchQuery)
        if (response.status === 'error') throw new Error(response.error)
        return response.data
      }
      return []
    },
    enabled: !!searchQuery && searchQuery.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000 // 5 minutes
  })
}

export const usePatient = (patientId: string) => {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const response = await PatientService.getPatient(patientId)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000
  })
}

export const useCreatePatient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patientData: {
      firstName: string
      lastName: string
      phone?: string
      email?: string
      preferences?: any
      tags?: string[]
    }) => {
      const response = await PatientService.createPatient(patientData)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    onSuccess: () => {
      // Invalidate patients queries
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    }
  })
}

// Real-time Subscription Hooks
export const useRealtimeSubscription = <T>(
  channelName: string,
  tableName: string,
  filter?: string,
  enabled: boolean = true
) => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['realtime-subscription', channelName],
    queryFn: () => {
      if (!enabled) return null

      return RealtimeService.createSubscription(
        channelName,
        tableName,
        filter,
        (payload) => {
          // Invalidate related queries when data changes
          queryClient.invalidateQueries({ queryKey: [tableName] })

          // You could also update specific cache entries
          if (payload.eventType === 'UPDATE' && payload.new) {
            const recordId = payload.new.id
            queryClient.setQueryData([tableName, recordId], payload.new)
          }
        }
      )
    },
    enabled,
    staleTime: Infinity, // Subscription doesn't get stale
    cacheTime: 0 // Don't cache the subscription itself
  })
}

export const useUserCallsSubscription = () => {
  const { user } = useSupabase()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['calls-subscription', user?.id],
    queryFn: () => {
      if (!user) return null

      return RealtimeService.subscribeToUserCalls(user.id, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['calls'] })

        if (payload.eventType === 'INSERT' && payload.new) {
          // Notify about new call
          console.log('New call:', payload.new)
        }
      })
    },
    enabled: !!user,
    staleTime: Infinity,
    cacheTime: 0
  })
}

export const useSecurityEventsSubscription = () => {
  const { user } = useSupabase()

  return useQuery({
    queryKey: ['security-events-subscription', user?.id],
    queryFn: () => {
      if (!user) return null

      return RealtimeService.subscribeToSecurityEvents(user.id, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const event = payload.new
          if (event.severity === 'high' || event.severity === 'critical') {
            // Handle high-priority security events
            console.warn('Security alert:', event)
            // You could show a toast notification here
          }
        }
      })
    },
    enabled: !!user,
    staleTime: Infinity,
    cacheTime: 0
  })
}

// Audit and Compliance Hooks
export const useAuditLogs = (query?: {
  userId?: string
  action?: string
  tableName?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}) => {
  return useQuery({
    queryKey: ['audit-logs', query],
    queryFn: async () => {
      const response = await AuditService.queryAuditLogs(query || {})
      if (response.status === 'error') throw new Error(response.error)
      return response
    },
    enabled: !!query,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000 // 2 minutes
  })
}

export const useSecurityEvents = (query?: {
  userId?: string
  action?: string
  resource?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'[]
  success?: boolean
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}) => {
  return useQuery({
    queryKey: ['security-events', query],
    queryFn: async () => {
      const response = await AuditService.querySecurityEvents(query || {})
      if (response.status === 'error') throw new Error(response.error)
      return response
    },
    enabled: !!query,
    staleTime: 30 * 1000,
    cacheTime: 2 * 60 * 1000
  })
}

export const useComplianceMetrics = () => {
  return useQuery({
    queryKey: ['compliance-metrics'],
    queryFn: async () => {
      const response = await AuditService.getComplianceMetrics()
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000 // Refetch every 10 minutes
  })
}

export const useRecordAuditTrail = (tableName: string, recordId: string) => {
  return useQuery({
    queryKey: ['audit-trail', tableName, recordId],
    queryFn: async () => {
      const response = await AuditService.getRecordAuditTrail(tableName, recordId)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    enabled: !!tableName && !!recordId,
    staleTime: 2 * 60 * 1000
  })
}

// Connection Status Hook
export const useRealtimeStatus = () => {
  const { realtimeStatus } = useSupabase()

  return useQuery({
    queryKey: ['realtime-status'],
    queryFn: async () => {
      const health = await RealtimeService.healthCheck()
      return {
        status: realtimeStatus,
        ...health
      }
    },
    refetchInterval: 30 * 1000, // Check every 30 seconds
    staleTime: 30 * 1000
  })
}

// Settings Sync Status Hook
export const useSettingsSyncStatus = () => {
  const { user } = useSupabase()

  return useQuery({
    queryKey: ['settings-sync-status', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      const response = await UserSettingsService.getSyncStatus(user.id)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000, // Check every 2 minutes
    staleTime: 60 * 1000 // 1 minute
  })
}

// Export Settings Hook
export const useExportSettings = () => {
  const { exportSettings } = useSupabase()

  return useMutation({
    mutationFn: async () => {
      const response = await exportSettings()
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    }
  })
}

// Import Settings Hook
export const useImportSettings = () => {
  const { importSettings } = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ settings, overwrite }: {
      settings: Partial<UserSettings>
      overwrite?: boolean
    }) => {
      const response = await importSettings(settings, overwrite)
      if (response.status === 'error') throw new Error(response.error)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
    }
  })
}