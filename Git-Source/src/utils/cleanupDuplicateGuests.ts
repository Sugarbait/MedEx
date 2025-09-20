/**
 * Utility to clean up duplicate Guest user entries from localStorage
 * This addresses the persistent Guest user recreation issue
 */

export async function cleanupDuplicateGuests(): Promise<{
  removed: number;
  keptUserId?: string;
  success: boolean
}> {
  try {
    console.log('Starting cleanup of duplicate Guest users...')

    // Get the current system users
    const storedUsers = localStorage.getItem('systemUsers')
    if (!storedUsers) {
      console.log('No system users found')
      return { removed: 0, success: true }
    }

    let users = []
    try {
      users = JSON.parse(storedUsers)
    } catch (parseError) {
      console.error('Failed to parse system users:', parseError)
      return { removed: 0, success: false }
    }

    // Find all Guest users (by email and potential name patterns)
    const guestUsers = users.filter((user: any) =>
      (user.email && user.email.toLowerCase() === 'guest@email.com') ||
      (user.name && user.name.toLowerCase() === 'guest') ||
      (user.id && user.id.toLowerCase().includes('guest'))
    )

    console.log(`Found ${guestUsers.length} Guest users`)

    if (guestUsers.length <= 1) {
      console.log('No duplicate Guest users found')
      return { removed: 0, success: true }
    }

    // Sort Guest users by creation date (keep the oldest one)
    guestUsers.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateA - dateB
    })

    // Keep the first (oldest) Guest user, remove the rest
    const userToKeep = guestUsers[0]
    const usersToRemove = guestUsers.slice(1)

    console.log(`Keeping Guest user with ID: ${userToKeep.id}`)
    console.log(`Removing ${usersToRemove.length} duplicate Guest users:`,
      usersToRemove.map((u: any) => u.id)
    )

    // Remove duplicates from the users array
    const idsToRemove = usersToRemove.map((u: any) => u.id)
    const cleanedUsers = users.filter((user: any) => !idsToRemove.includes(user.id))

    // Save the cleaned users list
    localStorage.setItem('systemUsers', JSON.stringify(cleanedUsers))

    // Remove individual user profile entries for the duplicates
    idsToRemove.forEach((userId: string) => {
      localStorage.removeItem(`userProfile_${userId}`)
      console.log(`Removed individual profile for Guest user: ${userId}`)
    })

    console.log(`Successfully removed ${usersToRemove.length} duplicate Guest users`)
    return {
      removed: usersToRemove.length,
      keptUserId: userToKeep.id,
      success: true
    }

  } catch (error) {
    console.error('Error cleaning up duplicate Guest users:', error)
    return { removed: 0, success: false }
  }
}

/**
 * Add Guest user IDs to the deleted users list to prevent recreation
 */
export async function addGuestToDeletedList(): Promise<boolean> {
  try {
    console.log('Adding Guest users to deleted list to prevent recreation...')

    // Get current deleted users list
    const deletedUsers = localStorage.getItem('deletedUsers')
    let deletedUserIds = []
    if (deletedUsers) {
      try {
        deletedUserIds = JSON.parse(deletedUsers)
      } catch (parseError) {
        console.warn('Failed to parse deleted users list:', parseError)
      }
    }

    // Get all Guest user IDs from current system
    const storedUsers = localStorage.getItem('systemUsers')
    if (storedUsers) {
      try {
        const users = JSON.parse(storedUsers)
        const guestUsers = users.filter((user: any) =>
          (user.email && user.email.toLowerCase() === 'guest@email.com') ||
          (user.name && user.name.toLowerCase() === 'guest') ||
          (user.id && user.id.toLowerCase().includes('guest'))
        )

        guestUsers.forEach((guestUser: any) => {
          if (!deletedUserIds.includes(guestUser.id)) {
            deletedUserIds.push(guestUser.id)
            console.log(`Added Guest user ID to deleted list: ${guestUser.id}`)
          }
        })
      } catch (parseError) {
        console.error('Failed to parse system users:', parseError)
      }
    }

    // Also add common Guest user ID patterns to prevent recreation
    const commonGuestIds = [
      'guest-user-123',
      'Guest',
      'guest'
    ]

    commonGuestIds.forEach(id => {
      if (!deletedUserIds.includes(id)) {
        deletedUserIds.push(id)
        console.log(`Added common Guest ID to deleted list: ${id}`)
      }
    })

    // Save updated deleted users list
    localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds))
    console.log('Guest users added to deleted list successfully')

    return true
  } catch (error) {
    console.error('Error adding Guest users to deleted list:', error)
    return false
  }
}

/**
 * Complete Guest user cleanup - removes duplicates and adds to deleted list
 */
export async function completeGuestCleanup(): Promise<{
  duplicatesRemoved: number;
  addedToDeletedList: boolean;
  success: boolean;
}> {
  console.log('Starting complete Guest user cleanup...')

  // First, clean up duplicates
  const cleanupResult = await cleanupDuplicateGuests()

  // Then add all Guest users to deleted list
  const addedToDeleted = await addGuestToDeletedList()

  // Finally, remove all Guest users from system
  if (cleanupResult.success && addedToDeleted) {
    try {
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        const users = JSON.parse(storedUsers)
        const nonGuestUsers = users.filter((user: any) =>
          !((user.email && user.email.toLowerCase() === 'guest@email.com') ||
            (user.name && user.name.toLowerCase() === 'guest') ||
            (user.id && user.id.toLowerCase().includes('guest')))
        )
        localStorage.setItem('systemUsers', JSON.stringify(nonGuestUsers))
        console.log('Removed all Guest users from system')
      }
    } catch (error) {
      console.error('Error removing Guest users from system:', error)
    }
  }

  return {
    duplicatesRemoved: cleanupResult.removed,
    addedToDeletedList: addedToDeleted,
    success: cleanupResult.success && addedToDeleted
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).cleanupDuplicateGuests = cleanupDuplicateGuests
  (window as any).addGuestToDeletedList = addGuestToDeletedList
  (window as any).completeGuestCleanup = completeGuestCleanup
}