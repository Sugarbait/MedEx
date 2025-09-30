// Manual User Data Restoration Script
// Run this in browser console to restore your user data

console.log('🔧 Starting Manual User Data Restoration...')

function manualRestoreUser() {
  console.log('📋 Manually restoring user data for pierre@phaetonai.com...')

  // Known user data from previous sessions
  const userData = {
    id: 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
    email: 'pierre@phaetonai.com',
    name: 'Pierre Detre',
    role: 'Super User',
    avatar_url: null
  }

  try {
    // Step 1: Restore currentUser
    console.log('1️⃣ Restoring currentUser...')
    localStorage.setItem('currentUser', JSON.stringify(userData))
    console.log('✅ currentUser restored')

    // Step 2: Restore systemUsers
    console.log('2️⃣ Restoring systemUsers...')
    const systemUsers = [userData]
    localStorage.setItem('systemUsers', JSON.stringify(systemUsers))
    console.log('✅ systemUsers restored')

    // Step 3: Restore allUserProfiles (for profile fields service)
    console.log('3️⃣ Restoring allUserProfiles...')
    const profileData = {
      ...userData,
      department: '',
      phone: '',
      location: '',
      bio: '',
      display_name: userData.name
    }
    const allProfiles = {}
    allProfiles[userData.id] = profileData
    localStorage.setItem('allUserProfiles', JSON.stringify(allProfiles))
    console.log('✅ allUserProfiles restored')

    // Step 4: Restore user-specific profile fields
    console.log('4️⃣ Restoring profile fields...')
    const profileFieldsKey = `profileFields_${userData.id}`
    const profileFields = {
      department: '',
      phone: '',
      location: '',
      bio: '',
      display_name: userData.name
    }
    localStorage.setItem(profileFieldsKey, JSON.stringify(profileFields))
    console.log('✅ Profile fields restored')

    // Step 5: Restore user settings
    console.log('5️⃣ Restoring user settings...')
    const settingsKey = `settings_${userData.id}`
    const settings = {
      api_key: 'key_c3f084f5ca67781070e188b47d7f',
      agent_id: 'agent_447a1b9da540237693b0440df6'
    }
    localStorage.setItem(settingsKey, JSON.stringify(settings))
    console.log('✅ User settings restored')

    // Step 6: Create backup
    console.log('6️⃣ Creating backup...')
    const backupKey = `userBackup_${userData.id}`
    localStorage.setItem(backupKey, JSON.stringify({
      user: userData,
      timestamp: Date.now()
    }))
    console.log('✅ Backup created')

    // Verify restoration
    console.log('\n🔍 Verification:')
    const verifyUser = localStorage.getItem('currentUser')
    if (verifyUser) {
      const parsed = JSON.parse(verifyUser)
      console.log('✅ currentUser verified:', parsed.email, '- ID:', parsed.id)
    } else {
      console.error('❌ currentUser verification failed')
    }

    const verifySystem = localStorage.getItem('systemUsers')
    if (verifySystem) {
      const parsed = JSON.parse(verifySystem)
      console.log('✅ systemUsers verified:', parsed.length, 'user(s)')
    } else {
      console.error('❌ systemUsers verification failed')
    }

    console.log('\n✨ Manual restoration complete!')
    console.log('📌 User ID:', userData.id)
    console.log('📌 Email:', userData.email)
    console.log('📌 Name:', userData.name)
    console.log('📌 Role:', userData.role)

    console.log('\n🎯 Next steps:')
    console.log('1. Refresh the page to load with restored user data')
    console.log('2. Navigate to Settings > Profile Information')
    console.log('3. Try saving profile fields (Department, Phone, etc.)')
    console.log('4. Check if fields persist after refresh')

    return true

  } catch (error) {
    console.error('❌ Restoration failed:', error)
    return false
  }
}

// Auto-run the restoration
const success = manualRestoreUser()

if (success) {
  console.log('\n✅ SUCCESS! Your user data has been restored.')
  console.log('🔄 Please refresh the page now.')
} else {
  console.log('\n❌ FAILED! Please check the error messages above.')
}

// Export for manual use if needed
window.manualRestoreUser = manualRestoreUser