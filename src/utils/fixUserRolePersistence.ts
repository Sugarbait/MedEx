/**
 * Fix User Role Persistence Issues
 *
 * This utility fixes issues where Super User roles revert to Staff/healthcare_provider
 * after login or page refresh. It ensures proper mapping between Azure AD accounts
 * and Super User profiles.
 */

import { supabase } from '@/config/supabase'

interface UserProfile {
  id: string
  azure_ad_id?: string
  email: string
  name: string
  role: string
  lastLogin?: string
  updatedAt?: string
}

export class UserRolePersistenceFixer {
  /**
   * Debug current user state across all storage locations
   */
  static async debugCurrentUserState(): Promise<void> {
    console.log('🔍 DEBUGGING USER STATE ACROSS ALL LOCATIONS')
    console.log('=====================================')

    // 1. Check localStorage
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser)
        console.log('📱 localStorage currentUser:', {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          azure_ad_id: user.azure_ad_id
        })
      } catch (error) {
        console.error('❌ Failed to parse localStorage currentUser:', error)
      }
    } else {
      console.log('📱 localStorage: No currentUser found')
    }

    // 2. Check systemUsers
    const systemUsers = localStorage.getItem('systemUsers')
    if (systemUsers) {
      try {
        const users = JSON.parse(systemUsers)
        console.log('📱 localStorage systemUsers:', users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role
        })))
      } catch (error) {
        console.error('❌ Failed to parse localStorage systemUsers:', error)
      }
    }

    // 3. Check Supabase users table
    try {
      const { data: supabaseUsers, error } = await supabase
        .from('users')
        .select('id, azure_ad_id, email, name, role, last_login')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Supabase users query failed:', error)
      } else {
        console.log('☁️ Supabase users table:', supabaseUsers)
      }
    } catch (error) {
      console.error('❌ Supabase connection failed:', error)
    }

    // 4. Check for Azure AD account info
    if (typeof window !== 'undefined' && (window as any).msalInstance) {
      try {
        const accounts = (window as any).msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          console.log('🔑 Azure AD Account:', {
            homeAccountId: accounts[0].homeAccountId,
            username: accounts[0].username,
            name: accounts[0].name
          })
        }
      } catch (error) {
        console.log('⚠️ Could not get Azure AD account info:', error)
      }
    }

    console.log('=====================================')
  }

  /**
   * Fix role persistence by ensuring proper Azure AD mapping
   */
  static async fixRolePersistence(targetEmail: string = 'elmfarrell@yahoo.com'): Promise<void> {
    console.log(`🔧 FIXING ROLE PERSISTENCE FOR: ${targetEmail}`)
    console.log('=====================================')

    try {
      // 1. Find the Super User in localStorage
      const systemUsers = localStorage.getItem('systemUsers')
      let superUser: UserProfile | null = null

      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        superUser = users.find((u: any) =>
          u.email === targetEmail && u.role === 'super_user'
        )
      }

      if (!superUser) {
        console.log('❌ Super User not found in localStorage, checking Supabase...')

        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', targetEmail)
          .eq('role', 'super_user')
          .single()

        if (error || !dbUser) {
          console.log('❌ Super User not found in database either. Creating...')
          await this.createSuperUser(targetEmail)
          return
        } else {
          superUser = dbUser
        }
      }

      if (!superUser) {
        console.error('❌ Could not find or create Super User')
        return
      }

      console.log('✅ Found Super User:', superUser)

      // 2. Get current Azure AD account
      let azureAccountId: string | null = null
      if (typeof window !== 'undefined' && (window as any).msalInstance) {
        try {
          const accounts = (window as any).msalInstance.getAllAccounts()
          if (accounts.length > 0) {
            azureAccountId = accounts[0].homeAccountId
            console.log('🔑 Current Azure AD account:', azureAccountId)
          }
        } catch (error) {
          console.log('⚠️ Could not get Azure AD account, using placeholder')
          azureAccountId = `azure-${Date.now()}`
        }
      }

      if (!azureAccountId) {
        azureAccountId = `azure-${Date.now()}`
      }

      // 3. Update Super User with Azure AD mapping
      const updatedUser = {
        ...superUser,
        azure_ad_id: azureAccountId,
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('users')
        .upsert({
          id: updatedUser.id,
          azure_ad_id: azureAccountId,
          email: updatedUser.email,
          name: updatedUser.name,
          role: 'super_user', // Ensure it stays super_user
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (updateError) {
        console.error('❌ Failed to update user in Supabase:', updateError)
      } else {
        console.log('✅ Successfully updated user in Supabase')
      }

      // Update in localStorage
      localStorage.setItem('currentUser', JSON.stringify(updatedUser))

      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === updatedUser.id)
        if (userIndex >= 0) {
          users[userIndex] = updatedUser
        } else {
          users.push(updatedUser)
        }
        localStorage.setItem('systemUsers', JSON.stringify(users))
      }

      console.log('✅ Role persistence fix completed!')
      console.log('🔄 Please refresh the page to see the changes')

      // Trigger events to update UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('userDataUpdated'))
        window.dispatchEvent(new CustomEvent('userRoleFixed', {
          detail: { userId: updatedUser.id, role: 'super_user' }
        }))
      }

    } catch (error) {
      console.error('❌ Error fixing role persistence:', error)
    }
  }

  /**
   * Create a Super User if none exists
   */
  static async createSuperUser(email: string): Promise<void> {
    console.log(`🔧 CREATING SUPER USER: ${email}`)

    const superUser = {
      id: `super-user-${Date.now()}`,
      email: email,
      name: email.includes('elmfarrell') ? 'Dr. Farrell' : 'Super User',
      role: 'super_user',
      azure_ad_id: `azure-${Date.now()}`,
      permissions: [
        { resource: '*', actions: ['*'] }
      ],
      lastLogin: new Date().toISOString(),
      mfaEnabled: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Insert into Supabase
    const { error: insertError } = await supabase
      .from('users')
      .insert(superUser)

    if (insertError) {
      console.error('❌ Failed to create Super User in Supabase:', insertError)
    } else {
      console.log('✅ Super User created successfully')
    }

    // Update localStorage
    localStorage.setItem('currentUser', JSON.stringify(superUser))

    const systemUsers = localStorage.getItem('systemUsers')
    let users = systemUsers ? JSON.parse(systemUsers) : []
    users.push(superUser)
    localStorage.setItem('systemUsers', JSON.stringify(users))

    console.log('✅ Super User creation completed!')
  }

  /**
   * Force refresh current user data to ensure Super User role
   */
  static async forceRefreshSuperUser(): Promise<void> {
    console.log('🔄 FORCE REFRESHING SUPER USER DATA')

    try {
      await this.debugCurrentUserState()
      await this.fixRolePersistence()

      // Force page reload to apply changes
      if (confirm('Role persistence fix applied. Reload page to see changes?')) {
        window.location.reload()
      }
    } catch (error) {
      console.error('❌ Error during force refresh:', error)
    }
  }
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  // Only expose static methods, not the class constructor
  (window as any).debugUserState = () => UserRolePersistenceFixer.debugCurrentUserState()
  (window as any).fixUserRole = () => UserRolePersistenceFixer.fixRolePersistence()
  (window as any).forceRefreshSuperUser = () => UserRolePersistenceFixer.forceRefreshSuperUser()
}

console.log('🔧 User Role Persistence Fixer loaded!')
console.log('💡 Available commands:')
console.log('  - debugUserState() - Debug current user state')
console.log('  - fixUserRole() - Fix role persistence issues')
console.log('  - forceRefreshSuperUser() - Force refresh to Super User')