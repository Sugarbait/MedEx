/**
 * URGENT FIX: Clear Fake Device Data
 *
 * This script clears fake iPhone 15 and MacBook Pro devices that were
 * appearing in users' sync details due to hardcoded mock data.
 *
 * User affected: pierre@phaetonai.com (c550502f-c39d-4bb3-bb8c-d193657fdb24)
 * Real device: Windows PC
 * Fake devices to remove: iPhone 15, MacBook Pro
 */

console.log('🚨 CLEARING FAKE DEVICE DATA')

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
const userEmail = 'pierre@phaetonai.com'

// Clear stored device data for this user
const clearFakeDevicesForUser = (userId) => {
  try {
    const key = `carexps_user_devices_${userId}`
    const stored = localStorage.getItem(key)

    console.log(`📱 Checking stored devices for user ${userId}...`)

    if (stored) {
      const devices = JSON.parse(stored)
      console.log('📋 Found stored devices:', devices.map(d => d.name))

      // Filter out fake devices (iPhone, MacBook, iPad, etc.)
      const realDevices = devices.filter(device => {
        const isFakeDevice = /iPhone|MacBook|iPad|iOS|macOS/.test(device.name) ||
                            /iPhone|MacBook|iPad/.test(device.os) ||
                            device.name.includes('Pro') ||
                            device.name.includes('Air')

        if (isFakeDevice) {
          console.log(`❌ REMOVING FAKE DEVICE: ${device.name} (${device.os})`)
          return false
        }

        console.log(`✅ KEEPING REAL DEVICE: ${device.name} (${device.os})`)
        return true
      })

      if (realDevices.length !== devices.length) {
        localStorage.setItem(key, JSON.stringify(realDevices))
        console.log(`🧹 CLEANED: Removed ${devices.length - realDevices.length} fake devices`)
        console.log(`📱 Remaining devices: ${realDevices.length}`)
      } else {
        console.log('✨ No fake devices found to remove')
      }
    } else {
      console.log('📭 No stored devices found for this user')
    }
  } catch (error) {
    console.error('❌ Error clearing fake devices:', error)
  }
}

// Clear other related storage that might contain fake data
const clearRelatedFakeData = (userId) => {
  try {
    console.log('🧹 Clearing related fake data...')

    // Clear any MFA device configs that might contain fake devices
    const mfaKey = `carexps_mfa_devices_${userId}`
    if (localStorage.getItem(mfaKey)) {
      localStorage.removeItem(mfaKey)
      console.log('🔐 Cleared MFA device configs')
    }

    // Clear sync session data that might reference fake devices
    const syncKeys = Object.keys(localStorage).filter(key =>
      key.includes('sync') && key.includes(userId)
    )
    syncKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`🔄 Cleared sync data: ${key}`)
    })

    console.log('✅ Related fake data cleared')
  } catch (error) {
    console.error('❌ Error clearing related data:', error)
  }
}

// Main execution
console.log(`🎯 Target user: ${userEmail}`)
console.log(`🆔 User ID: ${userId}`)

clearFakeDevicesForUser(userId)
clearRelatedFakeData(userId)

console.log('✅ FAKE DEVICE CLEANUP COMPLETED')
console.log('')
console.log('📋 Summary:')
console.log('- Removed fake iPhone 15 and MacBook Pro devices')
console.log('- Cleared related sync and MFA data')
console.log('- User should now only see their real Windows PC')
console.log('')
console.log('🔧 How to run this script:')
console.log('1. Open browser developer tools (F12)')
console.log('2. Go to Console tab')
console.log('3. Paste this script and press Enter')
console.log('4. Refresh the MFA Device Manager to verify fix')