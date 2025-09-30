/**
 * Utility to clear SMS segment cache after updating calculation logic
 * Run this in browser console or as a standalone script
 *
 * This clears the cached segment counts so all SMS records will be
 * recalculated using the updated toll-free limits (152/66)
 */

console.log('\n🔧 SMS Segment Cache Cleaner\n')
console.log('='.repeat(80))

// Check if running in browser
if (typeof localStorage !== 'undefined') {
  console.log('\n✅ Running in browser environment\n')

  // Clear the SMS segment cache
  const cacheKey = 'sms_segment_cache_v2'
  const existingCache = localStorage.getItem(cacheKey)

  if (existingCache) {
    console.log(`📦 Found existing cache: ${existingCache.length} bytes`)
    localStorage.removeItem(cacheKey)
    console.log('🗑️  Cleared SMS segment cache!')
  } else {
    console.log('ℹ️  No existing cache found')
  }

  console.log('\n✅ SMS segment cache cleared successfully!')
  console.log('All SMS records will now be recalculated using updated toll-free limits:')
  console.log('  - GSM-7: 160 (single) / 152 (concatenated)')
  console.log('  - UCS-2: 70 (single) / 66 (concatenated)')
  console.log('\nPlease refresh the SMS page to see updated calculations.')

} else {
  console.log('\n📋 Browser Console Instructions:\n')
  console.log('Copy and paste this into your browser console on the SMS page:\n')
  console.log('localStorage.removeItem("sms_segment_cache_v2"); console.log("✅ SMS segment cache cleared! Refresh the page.");')
  console.log('\nOr simply run: location.reload()')
}

console.log('\n' + '='.repeat(80))
console.log('\n')