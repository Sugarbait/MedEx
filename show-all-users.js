/**
 * Show All Users in the System
 * This script displays all users found in localStorage and other storage locations
 */

function showAllSystemUsers() {
  console.log("=" * 60)
  console.log("📊 ALL USERS IN THE SYSTEM")
  console.log("=" * 60)

  // 1. Check localStorage 'users' array
  console.log("\n📁 USERS IN localStorage 'users' ARRAY:")
  console.log("-" * 40)
  try {
    const users = localStorage.getItem('users')
    if (users) {
      const userList = JSON.parse(users)
      console.log(`Found ${userList.length} users:`)
      userList.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'Unknown Name'}`)
        console.log(`   📧 Email: ${user.email}`)
        console.log(`   🔑 ID: ${user.id}`)
        console.log(`   👤 Role: ${user.role}`)
        console.log(`   📅 Created: ${user.created_at || 'Unknown'}`)
        console.log(`   🔐 MFA: ${user.mfa_enabled ? 'Enabled' : 'Disabled'}`)
      })
    } else {
      console.log("❌ No users array found in localStorage")
    }
  } catch (e) {
    console.error("Error reading users array:", e)
  }

  // 2. Check current user
  console.log("\n\n👤 CURRENT USER:")
  console.log("-" * 40)
  try {
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const user = JSON.parse(currentUser)
      console.log(`Name: ${user.name}`)
      console.log(`Email: ${user.email}`)
      console.log(`ID: ${user.id}`)
      console.log(`Role: ${user.role}`)
    } else {
      console.log("❌ No current user logged in")
    }
  } catch (e) {
    console.error("Error reading current user:", e)
  }

  // 3. Check for user-specific settings
  console.log("\n\n⚙️ USER SETTINGS FOUND:")
  console.log("-" * 40)
  const settingsKeys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('settings_') || key.startsWith('user_') || key.startsWith('profile_'))) {
      settingsKeys.push(key)
    }
  }

  if (settingsKeys.length > 0) {
    console.log(`Found ${settingsKeys.length} user-related settings:`)
    settingsKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key)
        const parsed = JSON.parse(value)
        if (parsed.email) {
          console.log(`\n📌 ${key}:`)
          console.log(`   Email: ${parsed.email}`)
          console.log(`   Name: ${parsed.name || 'N/A'}`)
        } else {
          console.log(`📌 ${key}: (no email field)`)
        }
      } catch (e) {
        console.log(`📌 ${key}: (non-JSON or error parsing)`)
      }
    })
  } else {
    console.log("No user-specific settings found")
  }

  // 4. Check for any duplicate or orphaned user data
  console.log("\n\n🔍 CHECKING FOR DUPLICATES:")
  console.log("-" * 40)
  try {
    const users = localStorage.getItem('users')
    if (users) {
      const userList = JSON.parse(users)
      const emailMap = {}

      userList.forEach(user => {
        if (user.email) {
          const email = user.email.toLowerCase()
          if (!emailMap[email]) {
            emailMap[email] = []
          }
          emailMap[email].push(user)
        }
      })

      let hasDuplicates = false
      Object.entries(emailMap).forEach(([email, users]) => {
        if (users.length > 1) {
          hasDuplicates = true
          console.log(`\n⚠️ DUPLICATE FOUND for ${email}:`)
          users.forEach(user => {
            console.log(`   - ${user.name} (ID: ${user.id}, Role: ${user.role})`)
          })
        }
      })

      if (!hasDuplicates) {
        console.log("✅ No duplicate users found")
      }
    }
  } catch (e) {
    console.error("Error checking for duplicates:", e)
  }

  // 5. Summary
  console.log("\n\n📊 SUMMARY:")
  console.log("=" * 60)
  try {
    const users = localStorage.getItem('users')
    if (users) {
      const userList = JSON.parse(users)
      const superUsers = userList.filter(u => u.role === 'super_user')
      const regularUsers = userList.filter(u => u.role === 'user')

      console.log(`Total Users: ${userList.length}`)
      console.log(`Super Users: ${superUsers.length}`)
      console.log(`Regular Users: ${regularUsers.length}`)

      console.log("\n🔹 Super Users:")
      superUsers.forEach(u => {
        console.log(`   - ${u.email} (${u.name})`)
      })

      console.log("\n🔹 Regular Users:")
      regularUsers.forEach(u => {
        console.log(`   - ${u.email} (${u.name})`)
      })
    }
  } catch (e) {
    console.error("Error creating summary:", e)
  }

  console.log("\n" + "=" * 60)
  console.log("End of user report")
  console.log("=" * 60)
}

// Run the function
showAllSystemUsers()