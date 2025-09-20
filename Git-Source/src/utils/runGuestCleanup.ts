/**
 * Immediate execution script to clean up Guest users
 * Run this in the browser console to fix the duplicate Guest issue
 */

import { completeGuestCleanup } from './cleanupDuplicateGuests'

export async function runGuestCleanupNow() {
  console.log('=== STARTING GUEST USER CLEANUP ===')

  // Show current state
  const storedUsers = localStorage.getItem('systemUsers')
  if (storedUsers) {
    try {
      const users = JSON.parse(storedUsers)
      const guestUsers = users.filter((user: any) =>
        user.email && user.email.toLowerCase() === 'guest@email.com'
      )
      console.log(`Current Guest users found: ${guestUsers.length}`)
      guestUsers.forEach((user: any, index: number) => {
        console.log(`Guest ${index + 1}: ID=${user.id}, Created=${user.created_at}`)
      })
    } catch (error) {
      console.error('Error parsing users:', error)
    }
  }

  // Run cleanup
  const result = await completeGuestCleanup()

  console.log('=== CLEANUP RESULTS ===')
  console.log(`Duplicates removed: ${result.duplicatesRemoved}`)
  console.log(`Added to deleted list: ${result.addedToDeletedList}`)
  console.log(`Overall success: ${result.success}`)

  // Show final state
  const finalUsers = localStorage.getItem('systemUsers')
  if (finalUsers) {
    try {
      const users = JSON.parse(finalUsers)
      const remainingGuests = users.filter((user: any) =>
        user.email && user.email.toLowerCase() === 'guest@email.com'
      )
      console.log(`Remaining Guest users: ${remainingGuests.length}`)
    } catch (error) {
      console.error('Error parsing final users:', error)
    }
  }

  // Show deleted list
  const deletedUsers = localStorage.getItem('deletedUsers')
  if (deletedUsers) {
    try {
      const deleted = JSON.parse(deletedUsers)
      const guestDeletedIds = deleted.filter((id: string) =>
        id.toLowerCase().includes('guest') ||
        id.includes('Guest')
      )
      console.log(`Guest IDs in deleted list: ${guestDeletedIds.length}`)
      guestDeletedIds.forEach((id: string) => {
        console.log(`Deleted Guest ID: ${id}`)
      })
    } catch (error) {
      console.error('Error parsing deleted users:', error)
    }
  }

  console.log('=== CLEANUP COMPLETE ===')
  return result
}

// Export to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).runGuestCleanupNow = runGuestCleanupNow
}