/**
 * Clear SMS segment cache to force recalculation with updated +4 overhead
 * Run this after updating the SMS calculation logic
 */

console.log('🧹 Clearing SMS segment cache...')

// Clear all segment cache keys from localStorage
const keysToRemove = []
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key && key.includes('segment')) {
    keysToRemove.push(key)
  }
}

console.log(`Found ${keysToRemove.length} segment cache keys to remove:`, keysToRemove)

keysToRemove.forEach(key => {
  localStorage.removeItem(key)
  console.log(`✅ Removed: ${key}`)
})

console.log('✅ SMS segment cache cleared! Refresh the Dashboard to see updated calculations.')