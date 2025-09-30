// Profile Data Migration Script - Sync localhost data to Azure cloud
console.log('🔄 Starting profile data migration to Azure cloud...')

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'

// Profile data from localhost (based on your console logs)
const profileData = {
  display_name: 'Pierre',
  department: 'IT',
  phone: '+14165299916',
  bio: 'AI Prompt Engineer',
  location: 'Markham'
}

// User profile data
const userData = {
  name: 'Pierre Morenzie'  // The custom name you want to save
}

console.log('📋 Migration Data:')
console.log('User Data:', userData)
console.log('Profile Fields:', profileData)

async function migrateProfileData() {
  try {
    console.log('🔧 Creating Supabase client...')

    // Import Supabase (assuming it's available in the browser)
    if (typeof window !== 'undefined' && window.supabase) {
      const supabase = window.supabase

      console.log('👤 Step 1: Updating users table with name...')

      // Update the users table with the correct name
      const { data: userUpdate, error: userError } = await supabase
        .from('users')
        .update({
          username: userData.name,
          name: userData.name
        })
        .eq('id', userId)
        .select()

      if (userError) {
        console.error('❌ Failed to update users table:', userError)
      } else {
        console.log('✅ Users table updated successfully:', userUpdate)
      }

      console.log('📝 Step 2: Upserting user_profiles table...')

      // Upsert the user_profiles table with profile fields
      const { data: profileUpdate, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()

      if (profileError) {
        console.error('❌ Failed to update user_profiles table:', profileError)
      } else {
        console.log('✅ user_profiles table updated successfully:', profileUpdate)
      }

      console.log('🎉 Migration completed successfully!')
      console.log('💡 You should now see the profile data in Azure environment')

    } else {
      console.error('❌ Supabase client not available. Please run this in the browser console.')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Auto-run the migration
migrateProfileData()

// Also make it available for manual execution
window.migrateProfileData = migrateProfileData

console.log('💡 Migration script loaded. It will run automatically, or you can run: migrateProfileData()')