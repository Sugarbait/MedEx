// Debug Profile Fields - Run in Console
console.log('🔍 Debugging Profile Fields Issue...')

function debugProfileFields() {
  const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'

  console.log('📋 Checking all localStorage profile data...')

  // Check all profile-related localStorage keys
  const keys = [
    `profileFields_${userId}`,
    `userProfile_${userId}`,
    `profileData_${userId}`,
    `userFields_${userId}`,
    'allUserProfiles',
    'currentUser',
    'systemUsers'
  ]

  keys.forEach(key => {
    const data = localStorage.getItem(key)
    if (data) {
      try {
        const parsed = JSON.parse(data)
        console.log(`✅ ${key}:`, parsed)
      } catch (error) {
        console.log(`❌ ${key}: Failed to parse JSON`, error)
      }
    } else {
      console.log(`❌ ${key}: Not found`)
    }
  })

  console.log('\n📋 Testing bulletproof service directly...')

  // Test the bulletproof service directly
  if (typeof window.bulletproofProfileFieldsService !== 'undefined') {
    window.bulletproofProfileFieldsService.loadProfileFields(userId)
      .then(result => {
        console.log('🛡️ Bulletproof service result:', result)
      })
      .catch(error => {
        console.error('❌ Bulletproof service error:', error)
      })
  } else {
    console.log('❌ Bulletproof service not available')
  }

  console.log('\n📋 Current profile component state...')

  // Check current form values if available
  const inputs = {
    department: document.querySelector('input[name="department"]')?.value,
    phone: document.querySelector('input[name="phone"]')?.value,
    location: document.querySelector('input[name="location"]')?.value,
    bio: document.querySelector('textarea[name="bio"]')?.value,
    displayName: document.querySelector('input[name="displayName"]')?.value
  }

  console.log('📝 Current form values:', inputs)
}

// Auto-run
debugProfileFields()

// Make available for manual use
window.debugProfileFields = debugProfileFields

console.log('\n💡 Available commands:')
console.log('- debugProfileFields() - Run full diagnostic')
console.log('- Check console output above for detailed analysis')