/**
 * Apply Email Notifications Database Migration
 * Adds the email_notifications column to the user_settings table
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Supabase configuration
const supabaseUrl = 'https://cpkslvmydfdevdftieck.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('🔧 Applying Email Notifications Database Migration...')

  try {
    // Read and execute the migration SQL
    const migrationSQL = `
      -- Add the email_notifications column to user_settings table
      ALTER TABLE user_settings
      ADD COLUMN IF NOT EXISTS email_notifications JSONB DEFAULT '{
        "enabled": false,
        "recipientEmails": [],
        "notificationTypes": {
          "newSMS": true,
          "newCall": true,
          "securityAlerts": true,
          "systemAlerts": true
        }
      }'::jsonb;

      -- Add index for email notifications queries
      CREATE INDEX IF NOT EXISTS idx_user_settings_email_notifications
      ON user_settings USING GIN (email_notifications);
    `

    console.log('📧 Adding email_notifications column...')
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // Try direct query instead
      console.log('📧 Trying direct column addition...')
      const { error: alterError } = await supabase
        .from('user_settings')
        .select('email_notifications')
        .limit(1)

      if (alterError && alterError.message.includes('column "email_notifications" does not exist')) {
        console.log('📧 Column does not exist, migration needed')
        console.log('⚠️ Please manually apply the migration in your Supabase dashboard:')
        console.log('')
        console.log('Go to: https://app.supabase.com/project/cpkslvmydfdevdftieck/sql')
        console.log('Run this SQL:')
        console.log('')
        console.log(migrationSQL)
        console.log('')
        return false
      } else {
        console.log('✅ Column already exists!')
        return true
      }
    }

    console.log('✅ Email notifications migration applied successfully!')
    console.log('📧 Email notifications column is now available in user_settings table')
    return true

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('')
    console.log('📋 Manual Migration Required:')
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com/project/cpkslvmydfdevdftieck/sql')
    console.log('2. Run the SQL from: supabase-add-email-notifications-migration.sql')
    console.log('')
    return false
  }
}

applyMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Migration completed! Email notifications are ready to use.')
    } else {
      console.log('⚠️ Please apply the migration manually in Supabase dashboard.')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })