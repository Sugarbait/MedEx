import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabase } from '@/contexts/SupabaseContext'
import { CallNotesService } from '@/services/callNotesService'

/**
 * Custom hook to sync Azure AD authentication with Supabase
 * This ensures that when a user is authenticated via Azure AD,
 * their user ID is properly set in the Supabase services
 */
export const useSupabaseAuth = () => {
  const { user: azureUser, isAuthenticated } = useAuth()
  const { currentUserId, refreshUser, isConnected } = useSupabase()

  // Sync user authentication state
  useEffect(() => {
    if (isAuthenticated && azureUser && isConnected) {
      // Refresh Supabase user to ensure sync
      refreshUser()
    }
  }, [isAuthenticated, azureUser, isConnected, refreshUser])

  // Set current user ID in CallNotesService whenever it changes
  useEffect(() => {
    CallNotesService.setCurrentUserId(currentUserId)
  }, [currentUserId])

  return {
    isSupabaseAuthenticated: !!currentUserId,
    supabaseUserId: currentUserId,
    isSupabaseConnected: isConnected,
    azureUser,
    isAzureAuthenticated: isAuthenticated
  }
}