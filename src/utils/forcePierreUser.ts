/**
 * Force add Pierre user to system users immediately
 */

export function forcePierreUser() {
  console.log('🔧 Force adding Pierre user to system users...')

  try {
    // Pierre user data
    const pierreUser = {
      id: 'pierre-user-789',
      email: 'pierre@phaetonai.com',
      name: 'Pierre PhaetonAI',
      role: 'admin',
      mfa_enabled: false,
      settings: { theme: 'dark', notifications: {} },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Get existing users
    let existingUsers = []
    const storedUsers = localStorage.getItem('systemUsers')
    if (storedUsers) {
      try {
        existingUsers = JSON.parse(storedUsers)
      } catch (e) {
        console.warn('Failed to parse existing users, starting fresh')
        existingUsers = []
      }
    }

    // Check if Pierre already exists
    const pierreExists = existingUsers.some(user => user.id === 'pierre-user-789' || user.email === 'pierre@phaetonai.com')

    if (!pierreExists) {
      // Add Pierre to the users list
      existingUsers.push(pierreUser)

      // Save back to localStorage
      localStorage.setItem('systemUsers', JSON.stringify(existingUsers))

      console.log('✅ Pierre user added successfully!')
      console.log(`📊 Total users now: ${existingUsers.length}`)

      // Also remove from deleted users if present
      const deletedUsers = localStorage.getItem('deletedUsers')
      if (deletedUsers) {
        try {
          let deletedList = JSON.parse(deletedUsers)
          deletedList = deletedList.filter(id => id !== 'pierre-user-789' && id !== 'pierre@phaetonai.com')
          localStorage.setItem('deletedUsers', JSON.stringify(deletedList))
          console.log('🗑️ Removed Pierre from deleted users list')
        } catch (e) {
          console.warn('Failed to update deleted users list')
        }
      }

      return true
    } else {
      console.log('ℹ️ Pierre user already exists')
      return false
    }

  } catch (error) {
    console.error('❌ Failed to add Pierre user:', error)
    return false
  }
}

// Export to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).forcePierreUser = forcePierreUser
}