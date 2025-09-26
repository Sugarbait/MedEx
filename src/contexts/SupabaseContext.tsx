import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/config/supabase'
import { UserService } from '@/services/supabaseService'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User } from '@/types'

interface SupabaseUser {
  id: string
  azureAdId: string
  email: string
  name: string
  role: string
  isActive: boolean
}

interface SupabaseContextType {
  supabase: typeof supabase
  user: SupabaseUser | null
  isLoading: boolean
  isConnected: boolean
  currentUserId: string | null
  syncUserWithSupabase: (azureUser: any) => Promise<SupabaseUser | null>
  refreshUser: () => Promise<void>
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}

interface SupabaseProviderProps {
  children: ReactNode
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const { accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Test Supabase connection
  const testConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1)
      if (error) {
        console.warn('Supabase connection test failed:', error.message)
        return false
      }
      return true
    } catch (error) {
      console.warn('Supabase connection failed:', error)
      return false
    }
  }

  // Sync Azure AD user with Supabase user
  const syncUserWithSupabase = async (azureUser: any): Promise<SupabaseUser | null> => {
    try {
      if (!azureUser?.homeAccountId || !azureUser?.username || !azureUser?.name) {
        console.warn('Invalid Azure user data for Supabase sync')
        return null
      }

      // First, try to get existing user
      const existingUserResponse = await UserService.getUserByAzureId(azureUser.homeAccountId)

      if (existingUserResponse.status === 'success' && existingUserResponse.data) {
        const userData = existingUserResponse.data
        const supabaseUser: SupabaseUser = {
          id: userData.id,
          azureAdId: userData.azure_ad_id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          isActive: userData.is_active
        }

        // Update last login
        await UserService.updateLastLogin(userData.id)
        setCurrentUserId(userData.id)
        return supabaseUser
      }

      // User doesn't exist, create new user
      // Check if this is a super user email
      const superUserEmails = ['elmfarrell@yahoo.com', 'pierre@phaetonai.com']
      const userRole = superUserEmails.includes(azureUser.username.toLowerCase()) ? 'super_user' : 'staff'

      const createUserResponse = await UserService.createUser(azureUser.homeAccountId, {
        email: azureUser.username,
        name: azureUser.name,
        role: userRole
      })

      if (createUserResponse.status === 'success' && createUserResponse.data) {
        const userData = createUserResponse.data
        const supabaseUser: SupabaseUser = {
          id: userData.id,
          azureAdId: userData.azure_ad_id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          isActive: userData.is_active
        }

        setCurrentUserId(userData.id)
        return supabaseUser
      }

      return null
    } catch (error) {
      console.error('Failed to sync user with Supabase:', error)
      return null
    }
  }

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    if (!accounts.length || !isAuthenticated) {
      setUser(null)
      setCurrentUserId(null)
      return
    }

    try {
      setIsLoading(true)
      const azureUser = accounts[0]
      const supabaseUser = await syncUserWithSupabase(azureUser)
      setUser(supabaseUser)
    } catch (error) {
      console.error('Failed to refresh user:', error)
      setUser(null)
      setCurrentUserId(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize Supabase connection and user sync
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true)

      // Test connection
      const connected = await testConnection()
      setIsConnected(connected)

      if (!connected) {
        // Only log this message once per session to reduce console noise
        if (!sessionStorage.getItem('supabase-context-offline-logged')) {
          console.log('📱 Running in offline mode')
          sessionStorage.setItem('supabase-context-offline-logged', 'true')
        }
        setIsLoading(false)
        return
      }

      // Sync user if authenticated
      if (isAuthenticated && accounts.length > 0) {
        const azureUser = accounts[0]
        const supabaseUser = await syncUserWithSupabase(azureUser)
        setUser(supabaseUser)
      } else {
        setUser(null)
        setCurrentUserId(null)
      }

      setIsLoading(false)
    }

    initialize()
  }, [isAuthenticated, accounts])

  // Clear user when logged out
  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null)
      setCurrentUserId(null)
    }
  }, [isAuthenticated])

  const value: SupabaseContextType = {
    supabase,
    user,
    isLoading,
    isConnected,
    currentUserId,
    syncUserWithSupabase,
    refreshUser
  }

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  )
}