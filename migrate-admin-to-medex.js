/**
 * Migrate Admin to MedEx
 * Updates admin@phaetonai.com to MedEx tenant with Super User role
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function migrateAdminToMedEx() {
  console.log('🔧 Migrating admin@phaetonai.com to MedEx tenant...\n')

  try {
    const USER_ID = 'f99057b7-23bf-4d1b-8104-1f715a1a9851'
    const EMAIL = 'admin@phaetonai.com'

    // 1. Update user in users table
    console.log('📊 Updating user tenant and role...')
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        tenant_id: 'medex',
        role: 'super_user',
        updated_at: new Date().toISOString()
      })
      .eq('id', USER_ID)

    if (updateUserError) {
      console.error('❌ Error updating user:', updateUserError)
      return
    }
    console.log('✅ Updated users table')

    // 2. Update user_settings (if exists)
    console.log('\n📊 Updating user_settings...')
    const { error: updateSettingsError } = await supabase
      .from('user_settings')
      .update({
        tenant_id: 'medex',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', USER_ID)

    if (updateSettingsError && updateSettingsError.code !== 'PGRST116') {
      console.warn('⚠️ Error updating user_settings:', updateSettingsError)
    } else {
      console.log('✅ Updated user_settings table')
    }

    // 3. Verify the changes
    console.log('\n📊 Verifying changes...')
    const { data: updatedUser, error: verifyError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id')
      .eq('id', USER_ID)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError)
      return
    }

    console.log('\n✅ Migration completed successfully!')
    console.log(`\n   Email: ${updatedUser.email}`)
    console.log(`   Role: ${updatedUser.role}`)
    console.log(`   Tenant: ${updatedUser.tenant_id}`)
    console.log(`   ID: ${updatedUser.id}`)

    console.log('\n💡 Next steps:')
    console.log('   1. Clear your browser cache: localStorage.clear(); location.reload()')
    console.log('   2. Log in again with admin@phaetonai.com')
    console.log('   3. You should now be a Super User in MedEx!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Run the migration
migrateAdminToMedEx()
