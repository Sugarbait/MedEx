/**
 * Debug and Fix User Profile Issues
 * This script identifies and removes the problematic "User User" profiles
 */

console.log('🔍 DEBUGGING USER PROFILES...')
console.log('=' * 50)

// Check all localStorage keys for user data
function debugAllUserData() {
  console.log('\n📁 ALL USER-RELATED DATA IN LOCALSTORAGE:')

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.includes('user') || key.includes('User') || key.includes('current') || key.includes('settings'))) {
      try {
        const value = localStorage.getItem(key)
        const parsed = JSON.parse(value)

        console.log(`\n🔑 KEY: ${key}`)
        if (Array.isArray(parsed)) {
          console.log(`   📋 Array with ${parsed.length} items:`)
          parsed.forEach((item, index) => {
            if (item.email || item.name) {
              console.log(`     ${index}: ${item.name || 'No Name'} (${item.email || 'No Email'}) - Role: ${item.role || 'No Role'}`)
            }
          })
        } else if (parsed.email || parsed.name) {
          console.log(`   👤 User: ${parsed.name || 'No Name'} (${parsed.email || 'No Email'}) - Role: ${parsed.role || 'No Role'}`)
        } else {
          console.log(`   📄 Data: ${JSON.stringify(parsed).substring(0, 100)}...`)
        }
      } catch (e) {
        console.log(`\n🔑 KEY: ${key} (Non-JSON)`)
      }
    }
  }
}

// Fix the user profiles immediately
function fixUserProfiles() {
  console.log('\n🔧 FIXING USER PROFILES...')

  const ALLOWED_USERS = [
    {
      email: 'pierre@phaetonai.com',
      role: 'super_user',
      name: 'Pierre PhaetonAI',
      id: 'pierre-user-789'
    },
    {
      email: 'elmfarrell@yahoo.com',
      role: 'super_user',
      name: 'Elmer Farrell',
      id: 'super-user-456'
    },
    {
      email: 'guest@email.com',
      role: 'user',
      name: 'Guest User',
      id: 'demo-user-123'
    }
  ]

  // 1. Fix users array
  const usersData = localStorage.getItem('users')
  if (usersData) {
    try {
      const users = JSON.parse(usersData)
      console.log(`📋 Found ${users.length} users in array`)

      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())
      const cleanUsers = users.filter(user => {
        const email = user.email?.toLowerCase()
        const isAllowed = email && allowedEmails.includes(email)

        if (!isAllowed) {
          console.log(`❌ REMOVING: ${user.name || 'Unknown'} (${user.email || 'No Email'})`)
        } else {
          // Fix the user data
          const allowedUser = ALLOWED_USERS.find(u => u.email.toLowerCase() === email)
          if (allowedUser) {
            user.role = allowedUser.role
            user.name = allowedUser.name
            user.id = allowedUser.id
            console.log(`✅ FIXED: ${user.name} (${user.email}) - Role: ${user.role}`)
          }
        }

        return isAllowed
      })

      localStorage.setItem('users', JSON.stringify(cleanUsers))
      console.log(`💾 Saved ${cleanUsers.length} clean users`)
    } catch (e) {
      console.error('Error fixing users array:', e)
    }
  }

  // 2. Fix current user
  const currentUserData = localStorage.getItem('currentUser')
  if (currentUserData) {
    try {
      const currentUser = JSON.parse(currentUserData)
      const email = currentUser.email?.toLowerCase()
      const allowedUser = ALLOWED_USERS.find(u => u.email.toLowerCase() === email)

      if (allowedUser) {
        currentUser.role = allowedUser.role
        currentUser.name = allowedUser.name
        currentUser.id = allowedUser.id
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
        console.log(`✅ FIXED CURRENT USER: ${currentUser.name} (${currentUser.email}) - Role: ${currentUser.role}`)
      } else {
        console.log(`❌ REMOVING UNAUTHORIZED CURRENT USER: ${currentUser.name || 'Unknown'} (${currentUser.email || 'No Email'})`)
        localStorage.removeItem('currentUser')
      }
    } catch (e) {
      console.error('Error fixing current user:', e)
    }
  }

  // 3. Remove any "User User" or generic user entries
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.includes('user')) {
      try {
        const value = localStorage.getItem(key)
        const parsed = JSON.parse(value)

        // Check for problematic "User User" profiles
        if (parsed.name === 'User' || parsed.name === 'User User' ||
            (parsed.email && !ALLOWED_USERS.find(u => u.email.toLowerCase() === parsed.email.toLowerCase()))) {
          console.log(`🗑️ REMOVING PROBLEMATIC KEY: ${key}`)
          localStorage.removeItem(key)
        }
      } catch (e) {
        // Skip non-JSON
      }
    }
  }

  console.log('\n✅ USER PROFILE FIX COMPLETE!')
}

// Run the fixes
debugAllUserData()
fixUserProfiles()

console.log('\n🔄 Please refresh the page to see changes.')

// Also make this available globally
window.fixUserProfiles = fixUserProfiles
window.debugAllUserData = debugAllUserData